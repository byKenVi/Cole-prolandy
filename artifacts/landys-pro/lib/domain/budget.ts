/**
 * Budget normalization for lead intake. Integer cents only in domain logic.
 */

import type { BudgetBand } from "@prisma/client";
import { normalizeLiveBudgetBand } from "@/lib/taxonomy/live-v3";

const UNAMBIGUOUS_CURRENCY =
  /^\s*\$?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{2}))?\s*$/;

export type BudgetParseResult =
  | { ok: true; budgetCents: number; budgetRaw: string }
  | { ok: false; budgetRaw: string; reason: string };

export type BudgetResolutionResult =
  | { ok: true; kind: "exact"; budgetCents: number; budgetRaw: string }
  | { ok: true; kind: "band"; budgetBand: BudgetBand; budgetRaw: string }
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

/**
 * Resolve budget for live intake:
 * 1. Explicit budgetCents
 * 2. Recognized budget band label/code in budget text
 * 3. Otherwise hold for review (never guess an exact amount from a band)
 */
export function resolveLeadBudget(input: {
  budgetCents?: number | null;
  budget?: string | null;
  budgetBand?: BudgetBand | string | null;
}): BudgetResolutionResult {
  const exact = resolveBudgetCents(input);
  if (exact.ok) {
    return { ok: true, kind: "exact", budgetCents: exact.budgetCents, budgetRaw: exact.budgetRaw };
  }

  const raw = input.budget?.trim() ?? "";
  const bandFromField =
    typeof input.budgetBand === "string"
      ? normalizeLiveBudgetBand(input.budgetBand)
      : input.budgetBand ?? null;
  const band = bandFromField ?? normalizeLiveBudgetBand(raw);
  if (band) {
    return { ok: true, kind: "band", budgetBand: band, budgetRaw: raw || band };
  }

  return {
    ok: false,
    budgetRaw: raw,
    reason: exact.ok ? "" : exact.reason,
  };
}

const BAND_BOUNDARIES: Array<{ band: BudgetBand; minCents: number; maxCents: number | null }> = [
  { band: "UNDER_5K", minCents: 0, maxCents: 499_999 },
  { band: "BETWEEN_5K_15K", minCents: 500_000, maxCents: 1_500_000 },
  { band: "BETWEEN_15K_50K", minCents: 1_500_001, maxCents: 5_000_000 },
  { band: "OVER_50K", minCents: 5_000_001, maxCents: null },
];

/** Map an exact budget amount to a canonical band without inventing a cent value from a band label. */
export function inferBudgetBandFromCents(budgetCents: number): BudgetBand | null {
  if (!Number.isInteger(budgetCents) || budgetCents <= 0) return null;
  for (const boundary of BAND_BOUNDARIES) {
    if (budgetCents < boundary.minCents) continue;
    if (boundary.maxCents == null || budgetCents <= boundary.maxCents) {
      return boundary.band;
    }
  }
  return "OVER_50K";
}
