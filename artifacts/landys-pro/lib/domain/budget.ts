/**
 * Budget normalization for lead intake. Integer cents only in domain logic.
 */

const UNAMBIGUOUS_CURRENCY =
  /^\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?\s*$/;

export type BudgetParseResult =
  | { ok: true; budgetCents: number; budgetRaw: string }
  | { ok: false; budgetRaw: string; reason: string };

/** Parse unambiguous currency strings into integer cents. */
export function parseBudgetToCents(raw: string | null | undefined): BudgetParseResult {
  const budgetRaw = raw?.trim() ?? "";
  if (!budgetRaw) {
    return { ok: false, budgetRaw, reason: "Budget is required." };
  }

  const match = budgetRaw.match(UNAMBIGUOUS_CURRENCY);
  if (!match) {
    return {
      ok: false,
      budgetRaw,
      reason: "Budget could not be normalized to a single currency amount.",
    };
  }

  const whole = match[1].replace(/,/g, "");
  const fraction = match[2] ?? "00";
  const dollars = Number.parseInt(whole, 10);
  const centsPart = Number.parseInt(fraction.padEnd(2, "0").slice(0, 2), 10);
  if (!Number.isFinite(dollars) || !Number.isFinite(centsPart) || dollars < 0) {
    return { ok: false, budgetRaw, reason: "Budget is not a valid currency amount." };
  }

  const budgetCents = dollars * 100 + centsPart;
  if (budgetCents <= 0) {
    return { ok: false, budgetRaw, reason: "Budget must be greater than zero." };
  }

  return { ok: true, budgetCents, budgetRaw };
}

/** Resolve budget from structured cents or compatibility text parsing. */
export function resolveBudgetCents(input: {
  budgetCents?: number | null;
  budget?: string | null;
}): BudgetParseResult {
  if (input.budgetCents != null) {
    if (!Number.isInteger(input.budgetCents) || input.budgetCents <= 0) {
      return {
        ok: false,
        budgetRaw: input.budget ?? String(input.budgetCents),
        reason: "budgetCents must be a positive integer.",
      };
    }
    return {
      ok: true,
      budgetCents: input.budgetCents,
      budgetRaw: input.budget?.trim() || String(input.budgetCents),
    };
  }
  return parseBudgetToCents(input.budget);
}
