/**
 * Money helpers. THE ONLY place cents are converted to a display string.
 * Storage and logic are ALWAYS integer cents — never floats (see DESIGN.md §4).
 */

/** Format integer cents as USD, e.g. 123400 -> "$1,234.00". */
export function formatMoney(cents: number): string {
  if (!Number.isFinite(cents)) return "$0.00";
  const dollars = Math.trunc(cents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(dollars);
}

/** Parse a user-entered dollar string/number to integer cents. */
export function dollarsToCents(dollars: number | string): number {
  const n = typeof dollars === "string" ? Number.parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

/** Cents -> dollars number (for input field values only). */
export function centsToDollars(cents: number): number {
  return Math.trunc(cents) / 100;
}
