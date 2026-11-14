import { prisma } from "@/lib/prisma";
import { createContractorSignUpLink } from "@/lib/contractor-invitations";
import { notifyContractorInvitation } from "@/lib/notifications";

/**
 * Account invitations for contractors (mostly synced from landys.co).
 * Admins pick contractors and either send now or schedule a date/time; the
 * cron (and an immediate after-response run) drains the queue.
 */

/** Contractors who can still be invited: no portal account, not deactivated, has an email. */
export const invitableWhere = {
  clerkUserId: null,
  deactivatedAt: null,
  email: { contains: "@" },
} as const;

export async function scheduleContractorInvitations(params: {
  contractorIds: string[];
  sendAt: Date;
  actorEmail: string | null;
}): Promise<{ scheduled: number; skipped: number }> {
  const ids = [...new Set(params.contractorIds)].slice(0, 2000);
  const res = await prisma.contractor.updateMany({
    where: { id: { in: ids }, ...invitableWhere },
    data: { inviteScheduledFor: params.sendAt, inviteLastError: null },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: params.actorEmail,
      action: "contractor.invitations.scheduled",
      metadata: {
        requested: ids.length,
        scheduled: res.count,
        sendAt: params.sendAt.toISOString(),
      },
    },
  });
  return { scheduled: res.count, skipped: ids.length - res.count };
}

export async function cancelScheduledInvitations(params: {
  contractorIds: string[];
  actorEmail: string | null;
}): Promise<number> {
  const res = await prisma.contractor.updateMany({
    where: { id: { in: params.contractorIds }, inviteScheduledFor: { not: null } },
    data: { inviteScheduledFor: null },
  });
  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: params.actorEmail,
      action: "contractor.invitations.cancelled",
      metadata: { cancelled: res.count },
    },
  });
  return res.count;
}

export type InvitationQueueSummary = { sent: number; failed: number; remaining: number };

/** Send due invitations (bounded per run so one cron tick stays short). */
export async function processInvitationQueue(
  now: Date = new Date(),
  limit = 40,
): Promise<InvitationQueueSummary> {
  const due = await prisma.contractor.findMany({
    where: { ...invitableWhere, inviteScheduledFor: { lte: now } },
    orderBy: { inviteScheduledFor: "asc" },
    take: limit,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      smsOptedOutAt: true,
      serviceZipCodes: true,
      inviteScheduledFor: true,
    },
  });

  let sent = 0;
  let failed = 0;
  for (const contractor of due) {
    // Claim the row so two runs never invite the same contractor twice.
    const claimed = await prisma.contractor.updateMany({
      where: { id: contractor.id, inviteScheduledFor: contractor.inviteScheduledFor },
      data: { inviteScheduledFor: null },
    });
    if (claimed.count === 0) continue;

    try {
      const link = await createContractorSignUpLink(contractor);
      await notifyContractorInvitation({ contractor, signUpLink: link.url });
      await prisma.contractor.update({
        where: { id: contractor.id },
        data: {
          lastInvitedAt: new Date(),
          inviteCount: { increment: 1 },
          inviteLastError: link.error ? `Clerk: ${link.error}`.slice(0, 500) : null,
        },
      });
      await prisma.auditLog.create({
        data: {
          actorType: "system",
          action: "contractor.invitation.sent",
          targetType: "Contractor",
          targetId: contractor.id,
          metadata: { provider: link.provider, clerkError: link.error ?? null },
        },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.contractor
        .update({ where: { id: contractor.id }, data: { inviteLastError: message.slice(0, 500) } })
        .catch(() => undefined);
    }
  }

  const remaining = await prisma.contractor.count({
    where: { ...invitableWhere, inviteScheduledFor: { lte: now } },
  });
  return { sent, failed, remaining };
}
