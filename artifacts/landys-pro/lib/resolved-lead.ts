export function hasResolvedLeadSnapshot<
  T extends {
    tier: number | null;
    priceCents: number | null;
    expiresAt: Date | null;
  },
>(lead: T): lead is T & { tier: number; priceCents: number; expiresAt: Date } {
  return lead.tier !== null && lead.priceCents !== null && lead.expiresAt !== null;
}
