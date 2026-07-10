import { cookies } from "next/headers";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

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
};

const COOKIE = {
  role: "lp_role",
  contractor: "lp_contractor",
  viewAs: "lp_viewas",
} as const;

export function authMode(): "clerk" | "dev" {
  return process.env.AUTH_MODE === "clerk" ? "clerk" : "dev";
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
  const email = emails[0] ?? null;
  const isAdmin = userIsAdmin(user, emails);

  if (isAdmin) {
    const jar = await cookies();
    const viewAs = jar.get(COOKIE.viewAs)?.value ?? null;
    return {
      role: "admin",
      userId,
      contractorId: viewAs,
      viewingAs: Boolean(viewAs),
      email,
      needsOnboarding: false,
      deactivated: false,
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

  // Not linked yet — try to claim an ADMIN-CREATED contractor row (clerkUserId
  // null) by matching a Clerk-VERIFIED email (primary) or phone (secondary).
  // This is the primary onboarding path: the client's team enters contractors,
  // and the contractor simply signs in to adopt their existing profile.
  const verifiedEmails = collectVerifiedEmails(user);
  const verifiedPhones = collectVerifiedPhones(user);
  const claimed = await claimContractorForClerkUser(userId, verifiedEmails, verifiedPhones);

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
  const fromSession = await currentUser();
  // Right after sign-in, currentUser() can return a user shell with no usable
  // emails yet. Fall back to the Backend API so /post-auth still sees ADMIN_EMAILS.
  const sessionEmails = collectAllEmails(fromSession);
  if (sessionEmails.length > 0 || fromSession?.publicMetadata?.role === "admin") {
    return fromSession;
  }
  try {
    const client = await clerkClient();
    return await client.users.getUser(userId);
  } catch {
    return fromSession;
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

/** True when publicMetadata.role is admin or any user email is in ADMIN_EMAILS. */
export function userIsAdmin(user: ClerkUserLike, emails = collectAllEmails(user)): boolean {
  const metaRole = user?.publicMetadata?.role;
  if (metaRole === "admin") return true;
  const allowed = adminEmails();
  if (allowed.length === 0 || emails.length === 0) return false;
  return emails.some((e) => allowed.includes(e));
}

function collectVerifiedEmails(user: ClerkUserLike): string[] {
  return (user?.emailAddresses ?? [])
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase().trim())
    .filter(Boolean);
}

function collectVerifiedPhones(user: ClerkUserLike): string[] {
  // Normalize to E.164 so matching lines up with the canonical form we store on
  // contractors. Clerk phones are already E.164, but normalizing both sides
  // makes the comparison robust regardless of source formatting.
  const normalized = (user?.phoneNumbers ?? [])
    .filter((p) => p.verification?.status === "verified")
    .map((p) => normalizePhone(p.phoneNumber))
    .filter((p): p is string => Boolean(p));
  return Array.from(new Set(normalized));
}

/**
 * Link a signed-in Clerk user to a pre-existing (admin-created) Contractor.
 * Matches on a Clerk-VERIFIED email first, then a uniquely-matching verified
 * phone. Runs in a transaction and guards (clerkUserId still null) so one
 * Contractor can never be linked to two Clerk users. Returns the linked id or
 * null when nothing matched.
 */
async function claimContractorForClerkUser(
  userId: string,
  verifiedEmails: string[],
  verifiedPhones: string[],
): Promise<{ id: string; deactivated: boolean } | null> {
  if (verifiedEmails.length === 0 && verifiedPhones.length === 0) return null;

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

    // 2) Phone (secondary) — only if exactly one unclaimed row matches, to avoid
    // ambiguous links (phone is not unique).
    for (const phone of verifiedPhones) {
      const matches = await tx.contractor.findMany({
        where: { phone, clerkUserId: null },
        select: { id: true, deactivatedAt: true },
      });
      if (matches.length === 1) {
        const match = matches[0];
        if (match.deactivatedAt) {
          return { id: match.id, deactivated: true };
        }
        const res = await tx.contractor.updateMany({
          where: { id: match.id, clerkUserId: null },
          data: { clerkUserId: userId },
        });
        if (res.count === 1) {
          await auditLink(tx, match.id, userId, "phone");
          return { id: match.id, deactivated: false };
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
  via: "email" | "phone",
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

export const AUTH_COOKIES = COOKIE;
