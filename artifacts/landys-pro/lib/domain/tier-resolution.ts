import type { DbClient } from "./types";
import { InvalidStateError, PriceNotFoundError } from "./errors";
import { resolvePrice } from "./pricing";

export type TierThresholds = {
  tier1MaxBudgetCents: number;
  tier2MaxBudgetCents: number;
};

export type ResolveTierResult =
  | { ok: true; tier: 1 | 2 | 3; thresholds: TierThresholds }
  | { ok: false; reason: string };

/** Deterministic budget -> tier from configured thresholds. */
export function resolveTierFromBudget(
  budgetCents: number,
  thresholds: TierThresholds,
): 1 | 2 | 3 {
  if (budgetCents <= thresholds.tier1MaxBudgetCents) return 1;
  if (budgetCents <= thresholds.tier2MaxBudgetCents) return 2;
  return 3;
}

export async function loadTierThresholds(
  db: DbClient,
  params: { contractorTypeId: string; projectTypeId: string },
): Promise<TierThresholds | null> {
  const tiers = await db.priceTier.findMany({
    where: {
      contractorTypeId: params.contractorTypeId,
      projectTypeId: params.projectTypeId,
      tier: { in: [1, 2] },
    },
    select: { tier: true, maxBudgetCents: true },
  });

  const tier1 = tiers.find((t) => t.tier === 1)?.maxBudgetCents;
  const tier2 = tiers.find((t) => t.tier === 2)?.maxBudgetCents;
  if (tier1 == null || tier2 == null) return null;
  if (tier1 < 0 || tier2 <= tier1) return null;
  return { tier1MaxBudgetCents: tier1, tier2MaxBudgetCents: tier2 };
}

export function validateTierThresholds(thresholds: TierThresholds): string | null {
  if (thresholds.tier1MaxBudgetCents < 0) return "Tier 1 max budget must be zero or greater.";
  if (thresholds.tier2MaxBudgetCents <= thresholds.tier1MaxBudgetCents) {
    return "Tier 2 max budget must be greater than Tier 1 max budget.";
  }
  return null;
}

export async function resolveTierForBudget(
  db: DbClient,
  params: {
    contractorTypeId: string;
    projectTypeId: string;
    budgetCents: number;
  },
): Promise<ResolveTierResult> {
  const thresholds = await loadTierThresholds(db, params);
  if (!thresholds) {
    return { ok: false, reason: "Budget tier thresholds are not configured for this project." };
  }
  const invalid = validateTierThresholds(thresholds);
  if (invalid) return { ok: false, reason: invalid };
  const tier = resolveTierFromBudget(params.budgetCents, thresholds);
  return { ok: true, tier, thresholds };
}

export async function snapshotLeadPricing(
  db: DbClient,
  params: {
    contractorTypeId: string;
    projectTypeId: string;
    budgetCents: number;
  },
): Promise<{ tier: 1 | 2 | 3; priceCents: number }> {
  const resolved = await resolveTierForBudget(db, params);
  if (!resolved.ok) throw new InvalidStateError(resolved.reason);
  const priceCents = await resolvePrice(db, {
    contractorTypeId: params.contractorTypeId,
    projectTypeId: params.projectTypeId,
    tier: resolved.tier,
  });
  if (priceCents < 0) throw new PriceNotFoundError();
  return { tier: resolved.tier, priceCents };
}
