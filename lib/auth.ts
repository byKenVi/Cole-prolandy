import { cookies } from "next/headers";
import { auth, currentUser } from "@clerk/nextjs/server";
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
};

const COOKIE = {
  role: "lp_role",
  contractor: "lp_contractor",
  viewAs: "lp_viewas",
} as const;

export function authMode(): "clerk" | "dev" {
  return process.env.AUTH_MODE === "clerk" ? "clerk" : "dev";
}

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
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

  if (role === "admin") {
    return {
      role: "admin",
      userId: "dev-admin",
      contractorId: viewAs,
      viewingAs: Boolean(viewAs),
      email: "admin@prolandys.com",
      needsOnboarding: false,
    };
  }

  return {
    role: "contractor",
    userId: "dev-contractor",
    contractorId,
    viewingAs: false,
    email: null,
    needsOnboarding: false,
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
    };
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() ?? null;
  const metaRole = (user?.publicMetadata as { role?: string } | undefined)?.role;
  const isAdmin = metaRole === "admin" || (email !== null && adminEmails().includes(email));

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
    };
  }

  // Already linked?
  const linked = await prisma.contractor.findUnique({
    where: { clerkUserId: userId },
    select: { id: true },
  });
  if (linked) {
    return {
      role: "contractor",
      userId,
      contractorId: linked.id,
      viewingAs: false,
      email,
      needsOnboarding: false,
    };
  }

  // Not linked yet — try to claim an ADMIN-CREATED contractor row (clerkUserId
  // null) by matching a Clerk-VERIFIED email (primary) or phone (secondary).
  // This is the primary onboarding path: the client's team enters contractors,
  // and the contractor simply signs in to adopt their existing profile.
  const verifiedEmails = collectVerifiedEmails(user);
  const verifiedPhones = collectVerifiedPhones(user);
  const claimedId = await claimContractorForClerkUser(userId, verifiedEmails, verifiedPhones);

  return {
    role: "contractor",
    userId,
    contractorId: claimedId,
    viewingAs: false,
    email,
    // No existing row matched → fall back to self-service onboarding.
    needsOnboarding: !claimedId,
  };
}

type ClerkUserLike =
  | {
      emailAddresses?: { emailAddress: string; verification?: { status?: string } | null }[];
      phoneNumbers?: { phoneNumber: string; verification?: { status?: string } | null }[];
    }
  | null
  | undefined;

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
): Promise<string | null> {
  if (verifiedEmails.length === 0 && verifiedPhones.length === 0) return null;

  return prisma.$transaction(async (tx) => {
    // 1) Email (primary) — Contractor.email is unique, so at most one match.
    for (const email of verifiedEmails) {
      const candidate = await tx.contractor.findFirst({
        where: { email: { equals: email, mode: "insensitive" }, clerkUserId: null },
        select: { id: true },
      });
      if (candidate) {
        const res = await tx.contractor.updateMany({
          where: { id: candidate.id, clerkUserId: null },
          data: { clerkUserId: userId },
        });
        if (res.count === 1) {
          await auditLink(tx, candidate.id, userId, "email");
          return candidate.id;
        }
      }
    }

    // 2) Phone (secondary) — only if exactly one unclaimed row matches, to avoid
    // ambiguous links (phone is not unique).
    for (const phone of verifiedPhones) {
      const matches = await tx.contractor.findMany({
        where: { phone, clerkUserId: null },
        select: { id: true },
      });
      if (matches.length === 1) {
        const res = await tx.contractor.updateMany({
          where: { id: matches[0].id, clerkUserId: null },
          data: { clerkUserId: userId },
        });
        if (res.count === 1) {
          await auditLink(tx, matches[0].id, userId, "phone");
          return matches[0].id;
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
