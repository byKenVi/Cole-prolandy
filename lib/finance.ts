/**
 * Admin finance math: lead sales are revenue; contractor wallets are liability;
 * Stripe cash is how money moves. Safe-to-withdraw is the lead-sales cash that
 * is still available after reserving prepaid wallet balances.
 */

/** Net CA from lead sales (charges minus internal lead refunds). */
export function netLeadRevenueCents(leadChargeSumCents: number, leadRefundSumCents: number): number {
  const charged = Math.abs(leadChargeSumCents);
  const refunded = Math.max(0, leadRefundSumCents);
  return Math.max(0, charged - refunded);
}

export type SafeToWithdrawInput = {
  /** Net earned from accepted leads (after lead refunds). */
  netLeadRevenueCents: number;
  /** Σ contractor wallet balances — prepaid still owed / spendable. */
  heldForContractorsCents: number;
  /**
   * Stripe available balance in cents, or null when live Stripe data is
   * unavailable (mock / missing keys / API error).
   */
  stripeAvailableCents: number | null;
};

export type SafeToWithdrawResult = {
  /**
   * Cash from lead sales that can be withdrawn without dipping into prepaid
   * still sitting on contractor wallets. Null when Stripe balance is unknown.
   */
  safeToWithdrawCents: number | null;
  /** How much wallet liability exceeds Stripe cash (0 if covered). */
  uncoveredLiabilityCents: number;
};

/**
 * Safe withdraw ≈ min(net lead revenue, Stripe available − wallet liability).
 * Prior bank payouts reduce Stripe available, so we do not need payout history.
 */
export function computeSafeToWithdraw(input: SafeToWithdrawInput): SafeToWithdrawResult {
  const held = Math.max(0, Math.trunc(input.heldForContractorsCents));
  const earned = Math.max(0, Math.trunc(input.netLeadRevenueCents));

  if (input.stripeAvailableCents === null) {
    return { safeToWithdrawCents: null, uncoveredLiabilityCents: 0 };
  }

  const stripe = Math.trunc(input.stripeAvailableCents);
  const cashBeyondLiability = stripe - held;
  const uncoveredLiabilityCents = Math.max(0, -cashBeyondLiability);
  const safeToWithdrawCents = Math.max(0, Math.min(earned, cashBeyondLiability));

  return { safeToWithdrawCents, uncoveredLiabilityCents };
}

/** Prefer USD from a multi-currency Stripe balance list; else sum all. */
export function stripeAvailableUsdCents(
  entries: { amountCents: number; currency: string }[],
): number {
  if (entries.length === 0) return 0;
  const usd = entries.find((e) => e.currency.toLowerCase() === "usd");
  if (usd) return usd.amountCents;
  return entries.reduce((sum, e) => sum + e.amountCents, 0);
}

type SumClient = {
  walletTransaction: {
    aggregate: (args: {
      _sum: { amountCents: true };
      where: { type: "LEAD_CHARGE" | "REFUND" };
    }) => Promise<{ _sum: { amountCents: number | null } }>;
  };
};

/** Net lead CA from the ledger (charges − internal lead refunds). */
export async function queryNetLeadRevenueCents(db: SumClient): Promise<number> {
  const [chargeAgg, refundAgg] = await Promise.all([
    db.walletTransaction.aggregate({
      _sum: { amountCents: true },
      where: { type: "LEAD_CHARGE" },
    }),
    db.walletTransaction.aggregate({
      _sum: { amountCents: true },
      where: { type: "REFUND" },
    }),
  ]);
  return netLeadRevenueCents(chargeAgg._sum.amountCents ?? 0, refundAgg._sum.amountCents ?? 0);
}
