import { prisma } from "@/lib/prisma";
import { generateAcceptToken } from "@/lib/tokens";
import { getLandownerHireCheckDelayDays } from "@/lib/domain/settings";
import { notifyLandownerContractorAccepted } from "@/lib/notifications";

/**
 * Landowner side of an acceptance:
 *  1. right away: "<Company> wants to help with your project" (with contact);
 *  2. N days after the FIRST acceptance: "Did you hire one of these pros?"
 *     (sent by the cron, see lib/services/scheduled-jobs.ts).
 */
export async function afterContractorAccepted(leadMatchId: string): Promise<void> {
  await notifyLandownerContractorAccepted(leadMatchId);

  const match = await prisma.leadMatch.findUnique({
    where: { id: leadMatchId },
    select: { leadId: true, lead: { select: { landownerEmail: true } } },
  });
  if (!match?.lead.landownerEmail?.includes("@")) return;

  const delayDays = await getLandownerHireCheckDelayDays(prisma);
  const sendAfter = new Date(Date.now() + delayDays * 24 * 3600 * 1000);
  const existing = await prisma.landownerConfirmation.findUnique({
    where: { leadId: match.leadId },
    select: { id: true, sendAfter: true, sentAt: true, respondedAt: true },
  });
  if (!existing) {
    await prisma.landownerConfirmation
      .create({ data: { leadId: match.leadId, token: generateAcceptToken(), sendAfter } })
      .catch(() => undefined); // concurrent accept created it first
    return;
  }
  if (!existing.sendAfter && !existing.sentAt && !existing.respondedAt) {
    await prisma.landownerConfirmation.update({
      where: { id: existing.id },
      data: { sendAfter },
    });
  }
}
