import type { DbClient } from "./types";
import { PriceNotFoundError } from "./errors";

export type ResolvePriceParams = {
  contractorTypeId: string;
  projectTypeId: string;
  tier: number;
};

/**
 * Resolve the lead price (integer cents) from the PriceTier matrix, keyed by
 * (contractorType, projectType, tier). Never hardcode prices (business rule 4).
 * The caller snapshots this onto the Lead at creation so later matrix edits do
 * not retroactively change existing leads.
 */
export async function resolvePrice(
  db: DbClient,
  params: ResolvePriceParams,
): Promise<number> {
  const tier = await db.priceTier.findUnique({
    where: {
      contractorTypeId_projectTypeId_tier: {
        contractorTypeId: params.contractorTypeId,
        projectTypeId: params.projectTypeId,
        tier: params.tier,
      },
    },
    select: { priceCents: true },
  });
  if (!tier) throw new PriceNotFoundError();
  return tier.priceCents;
}
