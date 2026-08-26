import { LeadMatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureLandownerConfirmation } from "@/lib/domain/follow-up";
import { notifyLandownerConfirmation } from "@/lib/notifications";
import { leadScopeLabel, leadDisplayInclude } from "@/lib/resolved-lead";

/** Send landowner confirmation email once at least one contractor has accepted. */
export async function maybeNotifyLandownerAfterAccept(leadId: string) {
  const acceptedCount = await prisma.leadMatch.count({
    where: { leadId, status: LeadMatchStatus.ACCEPTED },
  });
  if (acceptedCount !== 1) return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: leadDisplayInclude,
  });
  if (!lead?.landownerEmail) return;

  const existing = await prisma.landownerConfirmation.findUnique({ where: { leadId } });
  if (existing?.respondedAt) return;

  const confirmation = await ensureLandownerConfirmation(leadId);
  await notifyLandownerConfirmation({
    landownerEmail: lead.landownerEmail,
    landownerName: lead.landownerName,
    token: confirmation.token,
    projectLabel: leadScopeLabel(lead),
  });
}
