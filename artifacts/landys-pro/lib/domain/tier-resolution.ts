import type { BudgetBand } from "@prisma/client";
import type { DbClient } from "./types";

/**
 * Display tier (1-3) for a budget band, from the admin-configured
 * BudgetBandTierMapping. Informative only in the success-fee model: lead
 * routing never depends on it.
 */
export async function resolveTierForBudgetBand(
  db: DbClient,
  params: { workTypeId: string; budgetBand: BudgetBand },
): Promise<{ ok: true; tier: 1 | 2 | 3 } | { ok: false; reason: string }> {
  const mapping = await db.budgetBandTierMapping.findUnique({
    where: {
      workTypeId_budgetBand: {
        workTypeId: params.workTypeId,
        budgetBand: params.budgetBand,
      },
    },
    select: { tier: true },
  });
  if (!mapping || mapping.tier < 1 || mapping.tier > 3) {
    return {
      ok: false,
      reason: "Budget band tier mapping is not configured for this work type.",
    };
  }
  return { ok: true, tier: mapping.tier as 1 | 2 | 3 };
}
