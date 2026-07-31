import "server-only";

import type { AdminRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const INVITE_TTL_DAYS = 7;

export type ClaimedInvite = { id: string; role: AdminRole };

/**
 * Grant admin access from a pending invitation, matching on a Clerk-verified
 * email address instead of the token from the invitation link.
 *
 * Why not the token: in production the api-server answers Clerk's
 * /v1/tickets/accept itself to dodge a Cloudflare bot challenge, and that
 * short-circuit redirects to /sign-up — discarding the redirectUrl the
 * invitation was created with, and with it the token. Matching on a *verified*
 * email keeps the same guarantee the token gave (the invitee must control the
 * mailbox the invitation was sent to) while surviving that redirect.
 *
 * Only ever pass emails Clerk has confirmed. An unverified address would let
 * anyone claim an invitation by typing someone else's email at sign-up.
 *
 * The invited role always wins over ADMIN_EMAILS bootstrap: an explicit
 * invitation to Admin must not be silently upgraded to Owner just because the
 * address also appears in the env list.
 */
export async function claimPendingAdminInvite({
  clerkUserId,
  verifiedEmails,
}: {
  clerkUserId: string;
  verifiedEmails: string[];
}): Promise<ClaimedInvite | null> {
  if (verifiedEmails.length === 0) return null;

  const invite = await prisma.adminInvite.findFirst({
    where: {
      email: { in: verifiedEmails, mode: "insensitive" },
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, role: true, invitedById: true },
  });
  if (!invite) {
    // No live invitation, but an older PENDING row may still be lingering for an
    // email that already has an AdminUser (the ADMIN_EMAILS bootstrap path used
    // to skip this function entirely). Sweep those so the Team page stays clean.
    await consumeStalePendingInvites(verifiedEmails);
    return null;
  }

  const email = invite.email.toLowerCase();

  const [admin] = await prisma.$transaction([
    prisma.adminUser.upsert({
      where: { email },
      create: {
        email,
        name: invite.name,
        role: invite.role,
        clerkUserId,
        invitedById: invite.invitedById ?? undefined,
        lastLoginAt: new Date(),
      },
      update: {
        // Invitation is authoritative — including demoting a mistaken Owner
        // that ADMIN_EMAILS created on a previous login.
        name: invite.name,
        role: invite.role,
        clerkUserId,
        disabledAt: null,
        lastLoginAt: new Date(),
      },
      select: { id: true, role: true },
    }),
    // Accept every pending invite for this mailbox, not just the newest one —
    // resends leave older PENDING rows that would otherwise stay visible.
    prisma.adminInvite.updateMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        status: "PENDING",
      },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorType: "admin",
        actorId: clerkUserId,
        action: "ADMIN_INVITE_ACCEPTED",
        targetType: "AdminInvite",
        targetId: invite.id,
        metadata: { email, role: invite.role, via: "verified-email" },
      },
    }),
  ]);

  return admin;
}

/**
 * Mark PENDING invitations as ACCEPTED when an AdminUser already exists for
 * the same email. Safe to call on every admin login and on the Team page —
 * it only touches rows that are already redundant.
 *
 * Also realigns the AdminUser role to the invitation's role when they disagree:
 * the ADMIN_EMAILS bootstrap used to force Owner and skip this path, which is
 * how invited Admins ended up with an Owner badge and a leftover pending row.
 */
export async function consumeStalePendingInvites(emails?: string[]): Promise<number> {
  const pending = await prisma.adminInvite.findMany({
    where: {
      status: "PENDING",
      ...(emails && emails.length > 0
        ? { email: { in: emails, mode: "insensitive" as const } }
        : {}),
    },
    select: { id: true, email: true, role: true },
  });
  if (pending.length === 0) return 0;

  const emailsToCheck = [...new Set(pending.map((p) => p.email.toLowerCase()))];
  const existing = await prisma.adminUser.findMany({
    where: { email: { in: emailsToCheck, mode: "insensitive" } },
    select: { id: true, email: true, role: true },
  });
  if (existing.length === 0) return 0;

  const byEmail = new Map(existing.map((a) => [a.email.toLowerCase(), a]));
  let touched = 0;

  for (const invite of pending) {
    const admin = byEmail.get(invite.email.toLowerCase());
    if (!admin) continue;

    await prisma.adminInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
    // Invitation role wins when the row was wrongly bootstrapped as Owner.
    if (admin.role !== invite.role) {
      await prisma.adminUser.update({
        where: { id: admin.id },
        data: { role: invite.role },
      });
    }
    touched += 1;
  }

  return touched;
}
