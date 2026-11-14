import { prisma } from "@/lib/prisma";
import { loadSuccessFeeTiers } from "@/lib/domain/success-fee";
import { feeRateLabelFor } from "@/lib/lead-summary";

/**
 * Version of the success-fee terms shown next to every Accept button and on
 * /terms. Bump it whenever the wording on /terms changes, so each acceptance
 * in the audit log points at the exact text the contractor agreed to.
 */
export const SUCCESS_FEE_TERMS_VERSION = "2026-11-13";

/** What the contractor sees (and agrees to) when accepting this opportunity. */
export async function termsSnapshot(where: { leadMatchId?: string; acceptToken?: string }) {
  const match = await prisma.leadMatch.findFirst({
    where: where.acceptToken ? { acceptToken: where.acceptToken } : { id: where.leadMatchId },
    select: { lead: { select: { budget: true, budgetCents: true, budgetBand: true } } },
  });
  if (!match) return { version: SUCCESS_FEE_TERMS_VERSION, feeRateLabel: null };
  const tiers = await loadSuccessFeeTiers(prisma);
  return { version: SUCCESS_FEE_TERMS_VERSION, feeRateLabel: feeRateLabelFor(tiers, match.lead) };
}
