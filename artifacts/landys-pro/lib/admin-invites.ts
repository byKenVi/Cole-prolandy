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
  if (!invite) return null;

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
        role: invite.role,
        clerkUserId,
        disabledAt: null,
        lastLoginAt: new Date(),
      },
      select: { id: true, role: true },
    }),
    prisma.adminInvite.update({
      where: { id: invite.id },
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
