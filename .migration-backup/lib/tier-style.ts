/**
 * Presentational tier-pill palette for the CONTRACTOR app. Leads carry a tier of
 * 1 / 2 / 3 (see Prisma `Lead.tier`). Each tier gets its own warm chip colour so
 * a Tier 3 lead never gets flattened into "Tier 2". Pure display — no data or
 * money logic lives here.
 */
export type TierPillStyle = { label: string; color: string; background: string };

export function tierPill(tier: number): TierPillStyle {
  switch (tier) {
    case 3:
      return { label: "Tier 3", color: "#7A3E1E", background: "#EFD8C4" };
    case 2:
      return { label: "Tier 2", color: "#8A5A1E", background: "#F4E6CE" };
    default:
      return { label: "Tier 1", color: "#7A6E58", background: "#EFE7D8" };
  }
}
