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

/**
 * Rough US card fee estimate (~2.9% + $0.30 per charge).
 * Used only for admin clarity — not a Stripe invoice.
 */
export function estimateStripeFeesCents(topupTotalCents: number, topupCount: number): number {
  const volume = Math.max(0, Math.trunc(topupTotalCents));
  const n = Math.max(0, Math.trunc(topupCount));
  return Math.round(volume * 0.029) + n * 30;
}

/**
 * Wallet float that must stay in Stripe. Promo grants are not real card cash,
 * so we exclude lifetime PROMO_CREDIT from held (conservative floor at 0).
 */
export function cashHeldForContractorsCents(
  walletBalanceSumCents: number,
  promoCreditSumCents: number,
): number {
  return Math.max(0, Math.trunc(walletBalanceSumCents) - Math.max(0, Math.trunc(promoCreditSumCents)));
}

export type SafeToWithdrawInput = {
  /** Net earned from accepted leads (after lead refunds). */
  netLeadRevenueCents: number;
  /** Prepaid still owed on wallets (cash-like; promo excluded when possible). */
  heldForContractorsCents: number;
  /**
   * Stripe available balance in cents, or null when live Stripe data is
   * unavailable (mock / missing keys / API error).
   */
  stripeAvailableCents: number | null;
  /** Stripe pending (settling) balance — not withdrawable yet. */
  stripePendingCents?: number | null;
};

export type SafeToWithdrawResult = {
  /**
   * Cash from lead sales that can be withdrawn now (available − held).
   * Null when Stripe balance is unknown.
   */
  safeToWithdrawCents: number | null;
  /**
   * Same idea after pending settles into available.
   * Null when Stripe balance is unknown.
   */
  safeAfterPendingCents: number | null;
  /**
   * How much wallet liability exceeds available + pending (0 if covered once
   * pending clears). Avoids alarming when cash is only settling.
   */
  uncoveredLiabilityCents: number;
};

/**
 * Safe withdraw ≈ min(net lead revenue, Stripe cash − wallet liability).
 * "Now" uses available only; "after pending" adds settling funds.
 */
export function computeSafeToWithdraw(input: SafeToWithdrawInput): SafeToWithdrawResult {
  const held = Math.max(0, Math.trunc(input.heldForContractorsCents));
  const earned = Math.max(0, Math.trunc(input.netLeadRevenueCents));

  if (input.stripeAvailableCents === null) {
    return {
      safeToWithdrawCents: null,
      safeAfterPendingCents: null,
      uncoveredLiabilityCents: 0,
    };
  }

  const available = Math.trunc(input.stripeAvailableCents);
  const pending = Math.max(0, Math.trunc(input.stripePendingCents ?? 0));
  const beyondAvailable = available - held;
  const beyondSettled = available + pending - held;

  return {
    safeToWithdrawCents: Math.max(0, Math.min(earned, beyondAvailable)),
    safeAfterPendingCents: Math.max(0, Math.min(earned, beyondSettled)),
    uncoveredLiabilityCents: Math.max(0, -beyondSettled),
  };
}

/** Prefer USD from a multi-currency Stripe balance list; else sum all. */
export function stripeUsdCents(entries: { amountCents: number; currency: string }[]): number {
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
