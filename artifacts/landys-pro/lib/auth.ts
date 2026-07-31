import { cookies } from "next/headers";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { claimPendingAdminInvite } from "@/lib/admin-invites";

/**
 * Auth abstraction.
 *
 * Master switch: AUTH_MODE. When "clerk", real Clerk auth is used (contractor +
 * admin roles). Otherwise a DEV auth mode runs with NO keys (role/contractor
 * switcher in cookies) so the app is fully navigable during development.
 *
 * The tokenized SMS accept flow is intentionally UNAUTHENTICATED regardless.
 */
export type Role = "contractor" | "admin";
export type AdminRole = "owner" | "admin";

export type Session = {
  role: Role;
  /** Clerk user id when signed in (clerk mode only). */
  userId: string | null;
  /** The contractor whose data should be shown on contractor screens. */
  contractorId: string | null;
  /** True when an admin is viewing the app as a contractor. */
  viewingAs: boolean;
  email: string | null;
  /** True in clerk mode when signed in but no contractor profile exists yet. */
  needsOnboarding: boolean;
  /** True when the linked contractor was soft-deactivated by admin. */
  deactivated: boolean;
  /**
   * Sub-role for admin users. "owner" = full team management; "admin" =
   * dashboard access only. Only set when role === "admin".
   */
  adminRole?: AdminRole;
  /** DB id of the AdminUser record (when role === "admin" in clerk mode). */
  adminUserId?: string | null;
};

const COOKIE = {
  role: "lp_role",
  contractor: "lp_contractor",
  viewAs: "lp_viewas",
} as const;

export function authMode(): "clerk" | "dev" {
  // Only activate Clerk when a publishable key is present. Without it, @clerk/nextjs
  // enters keyless mode which crashes in proxied environments (e.g. Replit preview)
  // because the /clerk-sync-keyless redirect is blocked by CORS. Fall back to dev
  // cookie-auth so the app stays navigable until Clerk keys are configured.
  //
  // CLERK_PUBLISHABLE_KEY = Replit-managed (setupClerkWhitelabelAuth).
  // NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = manually supplied key.
  // next.config.ts forwards CLERK_PUBLISHABLE_KEY into the NEXT_PUBLIC_ namespace
  // at compile time; checking both here covers the server-side runtime path.
  const hasKey =
    !!process.env.CLERK_PUBLISHABLE_KEY ||
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return process.env.AUTH_MODE === "clerk" && hasKey ? "clerk" : "dev";
}

/**
 * Fail-closed startup guard. In production the app MUST run real Clerk auth:
 * dev auth trusts a self-set `lp_role=admin` cookie, which would grant anyone
 * full admin. Throwing here (invoked from instrumentation `register()`) stops the
 * server from booting in an insecure configuration. Dev is unaffected.
 */
export function assertAuthConfigFailClosed(): void {
  if (process.env.NODE_ENV === "production" && authMode() !== "clerk") {
    throw new Error(
      'FATAL: AUTH_MODE must be "clerk" in production. Dev auth (self-set lp_role ' +
        "cookie) grants unauthenticated admin access and is refused at startup. " +
        "Set AUTH_MODE=clerk and provide Clerk keys.",
    );
  }
}

/**
 * Parse ADMIN_EMAILS from env. Strips wrapping quotes (common when values are
 * copy-pasted into Vercel with quotes) and normalizes case/whitespace.
 */
export function parseAdminEmails(raw: string | undefined | null): string[] {
  return (raw ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .split(",")
    .map((e) => e.trim().toLowerCase().replace(/^["']|["']$/g, ""))
    .filter((e) => e.includes("@"));
}

function adminEmails(): string[] {
  return parseAdminEmails(process.env.ADMIN_EMAILS);
}

/** Resolve the current session. */
export async function getSession(): Promise<Session> {
  return authMode() === "clerk" ? getClerkSession() : getDevSession();
}

// ── DEV auth ─────────────────────────────────────────────────

async function getDevSession(): Promise<Session> {
  const jar = await cookies();
  const role = (jar.get(COOKIE.role)?.value as Role) ?? "contractor";
  const viewAs = jar.get(COOKIE.viewAs)?.value ?? null;
  let contractorId = jar.get(COOKIE.contractor)?.value ?? null;

  if (role === "contractor" && !contractorId) {
    const first = await prisma.contractor.findFirst({ orderBy: { createdAt: "asc" } });
    contractorId = first?.id ?? null;
  }

  // Defense in depth: dev auth must NEVER yield admin in production, even if the
  // startup guard were somehow bypassed. A self-set cookie can't become admin.
  if (role === "admin" && process.env.NODE_ENV !== "production") {
    return {
      role: "admin",
      userId: "dev-admin",
      contractorId: viewAs,
      viewingAs: Boolean(viewAs),
      email: "admin@prolandys.com",
      needsOnboarding: false,
      deactivated: false,
      adminRole: "owner" as AdminRole,
      adminUserId: null,
    };
  }

  return {
    role: "contractor",
    userId: "dev-contractor",
    contractorId,
    viewingAs: false,
    email: null,
    needsOnboarding: false,
    deactivated: false,
  };
}

// ── Clerk auth ───────────────────────────────────────────────

async function getClerkSession(): Promise<Session> {
  const { userId } = await auth();
  if (!userId) {
    return {
      role: "contractor",
      userId: null,
      contractorId: null,
      viewingAs: false,
      email: null,
      needsOnboarding: false,
      deactivated: false,
    };
  }

  // currentUser() can be briefly incomplete right after sign-in; fall back to
  // the Backend API so admin email matching still works on /post-auth.
  const user = await resolveClerkUser(userId);
  const emails = collectAllEmails(user);
  const verifiedEmails = collectVerifiedEmails(user);
  const email = emails[0] ?? null;

  // ── Admin resolution ──────────────────────────────────────────────────
  // 1. Pending invitations for a verified email are claimed first — the
  //    invited role is authoritative (an invite to Admin must not become Owner
  //    just because the address also sits in ADMIN_EMAILS).
  // 2. Existing AdminUser rows grant access (unless disabled).
  // 3. ADMIN_EMAILS is a bootstrap only: it creates an Owner when no AdminUser
  //    and no invitation apply. It never overrides an invited / stored role.
  const allowed = adminEmails();
  const isEnvBootstrap =
    allowed.length > 0 && verifiedEmails.some((e) => allowed.includes(e));

  let dbAdmin: { id: string; role: string; disabledAt: Date | null } | null = null;

  if (verifiedEmails.length > 0) {
    // Always try the invitation path first, even for ADMIN_EMAILS addresses —
    // previously we skipped it when isEnvAdmin was true, which left the invite
    // PENDING forever and forced Owner on the AdminUser row.
    const claimed = await claimPendingAdminInvite({ clerkUserId: userId, verifiedEmails });
    if (claimed) {
      dbAdmin = { ...claimed, disabledAt: null };
    } else {
      dbAdmin = await prisma.adminUser.findFirst({
        where: {
          OR: [
            { clerkUserId: userId },
            { email: { in: verifiedEmails, mode: "insensitive" } },
          ],
        },
        select: { id: true, role: true, disabledAt: true },
      });
    }
  }

  if ((dbAdmin && !dbAdmin.disabledAt) || (isEnvBootstrap && !dbAdmin?.disabledAt)) {
    // Upsert links Clerk + lastLogin. Pass isEnvOwner only when there is no
    // AdminUser yet so bootstrap can create the first Owner; never on update.
    const adminUserRecord = await upsertAdminUser({
      clerkUserId: userId,
      email: email ?? verifiedEmails[0] ?? "",
      user,
      isEnvOwner: isEnvBootstrap && !dbAdmin,
      existingId: dbAdmin?.id,
    });

    const jar = await cookies();
    const viewAs = jar.get(COOKIE.viewAs)?.value ?? null;
    const resolvedRole = adminUserRecord?.role ?? dbAdmin?.role;
    const adminRole: AdminRole = resolvedRole === "OWNER" ? "owner" : "admin";

    return {
      role: "admin",
      userId,
      contractorId: viewAs,
      viewingAs: Boolean(viewAs),
      email,
      needsOnboarding: false,
      deactivated: false,
      adminRole,
      adminUserId: adminUserRecord?.id ?? dbAdmin?.id ?? null,
    };
  }

  // Already linked?
  const linked = await prisma.contractor.findUnique({
    where: { clerkUserId: userId },
    select: { id: true, deactivatedAt: true },
  });
  if (linked) {
    if (linked.deactivatedAt) {
      return {
        role: "contractor",
        userId,
        contractorId: null,
        viewingAs: false,
        email,
        needsOnboarding: false,
        deactivated: true,
      };
    }
    return {
      role: "contractor",
      userId,
      contractorId: linked.id,
      viewingAs: false,
      email,
      needsOnboarding: false,
      deactivated: false,
    };
  }

  // Not linked yet — claim only an admin-created row whose email is verified by
  // Clerk. Phone numbers are not an account-ownership credential.
  // This is the primary onboarding path: the client's team enters contractors,
  // and the contractor simply signs in to adopt their existing profile.
  // (verifiedEmails was already collected above for the admin check.)
  const claimed = await claimContractorForClerkUser(userId, verifiedEmails);

  if (claimed?.deactivated) {
    return {
      role: "contractor",
      userId,
      contractorId: null,
      viewingAs: false,
      email,
      needsOnboarding: false,
      deactivated: true,
    };
  }

  return {
    role: "contractor",
    userId,
    contractorId: claimed?.id ?? null,
    viewingAs: false,
    email,
    // No existing row matched → fall back to self-service onboarding.
    needsOnboarding: !claimed,
    deactivated: false,
  };
}

type ClerkUserLike =
  | {
      primaryEmailAddress?: { emailAddress: string } | null;
      emailAddresses?: { emailAddress: string; verification?: { status?: string } | null }[];
      phoneNumbers?: { phoneNumber: string; verification?: { status?: string } | null }[];
      publicMetadata?: Record<string, unknown> | null;
    }
  | null
  | undefined;

async function resolveClerkUser(userId: string): Promise<ClerkUserLike> {
  try {
    const client = await clerkClient();
    return await client.users.getUser(userId);
  } catch {
    return currentUser();
  }
}

/** All emails on the Clerk user (primary first), lowercased. */
export function collectAllEmails(user: ClerkUserLike): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw?: string | null) => {
    const e = raw?.toLowerCase().trim();
    if (!e || seen.has(e)) return;
    seen.add(e);
    out.push(e);
  };
  push(user?.primaryEmailAddress?.emailAddress);
  for (const entry of user?.emailAddresses ?? []) {
    push(entry.emailAddress);
  }
  return out;
}

/** Quick check: is this Clerk user in the ADMIN_EMAILS bootstrap list? */
export function userIsAdmin(user: ClerkUserLike): boolean {
  const emails = collectVerifiedEmails(user);
  if (emails.length === 0) return false;
  const allowed = adminEmails();
  if (allowed.length > 0 && emails.some((e) => allowed.includes(e))) return true;
  // DB / invitation checks happen in getClerkSession.
  return false;
}

function collectVerifiedEmails(user: ClerkUserLike): string[] {
  return (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase().trim())
    .filter(Boolean);
}

/**
 * Link a signed-in Clerk user to a pre-existing (admin-created) Contractor.
 * Matches on a Clerk-verified email. Runs in a transaction and guards
 * (clerkUserId still null) so one
 * Contractor can never be linked to two Clerk users. Returns the linked id or
 * null when nothing matched.
 */
async function claimContractorForClerkUser(
  userId: string,
  verifiedEmails: string[],
): Promise<{ id: string; deactivated: boolean } | null> {
  if (verifiedEmails.length === 0) return null;

  return prisma.$transaction(async (tx) => {
    // 1) Email (primary) — Contractor.email is unique, so at most one match.
    for (const email of verifiedEmails) {
      const candidate = await tx.contractor.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, clerkUserId: null },
        select: { id: true, deactivatedAt: true },
      });
      if (candidate) {
        if (candidate.deactivatedAt) {
          return { id: candidate.id, deactivated: true };
        }
        const res = await tx.contractor.updateMany({
          where: { id: candidate.id, clerkUserId: null },
          data: { clerkUserId: userId },
        });
        if (res.count === 1) {
          await auditLink(tx, candidate.id, userId, "email");
          return { id: candidate.id, deactivated: false };
        }
      }
    }

    return null;
  });
}

async function auditLink(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  contractorId: string,
  clerkUserId: string,
  via: "email",
) {
  await tx.auditLog.create({
    data: {
      actorType: "contractor",
      actorId: clerkUserId,
      action: "contractor.clerk.linked",
      targetType: "Contractor",
      targetId: contractorId,
      metadata: { via, clerkUserId },
    },
  });
}

/**
 * Upsert the AdminUser record on every admin login.
 * - New ADMIN_EMAILS bootstrap (isEnvOwner && no existing row) creates an Owner.
 * - Existing rows keep their stored role — invitations and Team actions own it.
 * Returns the upserted record (id + role).
 */
async function upsertAdminUser({
  clerkUserId,
  email,
  user,
  isEnvOwner,
  existingId,
}: {
  clerkUserId: string;
  email: string;
  user: ClerkUserLike;
  isEnvOwner: boolean;
  existingId?: string;
}): Promise<{ id: string; role: string } | null> {
  try {
    const name =
      (user as { firstName?: string; lastName?: string } | null | undefined)
        ?.firstName
        ? [
            (user as { firstName?: string }).firstName,
            (user as { lastName?: string }).lastName,
          ]
            .filter(Boolean)
            .join(" ")
        : email.split("@")[0] ?? "Administrator";

    if (existingId) {
      // Already exists — link Clerk userId if not yet set, update login time.
      // Role is never changed here; Team actions / invitation claims own it.
      return await prisma.adminUser.update({
        where: { id: existingId },
        data: { clerkUserId, lastLoginAt: new Date() },
        select: { id: true, role: true },
      });
    }

    // First sight of this email: bootstrap Owner from ADMIN_EMAILS, otherwise Admin.
    return await prisma.adminUser.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        name,
        role: isEnvOwner ? "OWNER" : "ADMIN",
        clerkUserId,
        lastLoginAt: new Date(),
      },
      update: {
        clerkUserId,
        lastLoginAt: new Date(),
      },
      select: { id: true, role: true },
    });
  } catch {
    // Non-critical — don't fail the session if the upsert errors.
    return null;
  }
}

// ── Guards ───────────────────────────────────────────────────

export async function requireContractorId(): Promise<string> {
  const s = await getSession();
  if (!s.contractorId) {
    throw new Error("No contractor context. Sign in as a contractor or view as one.");
  }
  return s.contractorId;
}

export async function requireAdmin(): Promise<Session> {
  const s = await getSession();
  if (s.role !== "admin") throw new Error("Admin access required.");
  return s;
}

/** Only Owners may manage the Team page and invite/modify admins. */
export async function requireOwner(): Promise<Session> {
  const s = await getSession();
  if (s.role !== "admin") throw new Error("Admin access required.");
  if (s.adminRole !== "owner") throw new Error("Owner access required.");
  return s;
}

export const AUTH_COOKIES = COOKIE;
