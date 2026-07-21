/**
 * Wallet top-up amount rules. Shared by the UI, the server action (authoritative
 * enforcement), and tests so limits can never drift between client and server.
 * Money is ALWAYS integer cents.
 */

export const TOPUP_MIN_CENTS = 1000; // $10 minimum
export const TOPUP_MAX_CENTS = 1000000; // $10,000 maximum
export const TOPUP_PRESETS_CENTS: readonly number[] = [5000, 10000, 25000, 50000]; // $50 / $100 / $250 / $500

export type TopUpValidation = { ok: true; amountCents: number } | { ok: false; message: string };

/** Validate a chosen top-up amount (integer cents) against the min/max bounds. */
export function validateTopUpAmountCents(amountCents: number): TopUpValidation {
  if (!Number.isInteger(amountCents)) {
    return { ok: false, message: "Enter a valid amount." };
  }
  if (amountCents < TOPUP_MIN_CENTS) {
    return { ok: false, message: `Minimum top-up is ${formatCents(TOPUP_MIN_CENTS)}.` };
  }
  if (amountCents > TOPUP_MAX_CENTS) {
    return { ok: false, message: `Maximum top-up is ${formatCents(TOPUP_MAX_CENTS)}.` };
  }
  return { ok: true, amountCents };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
