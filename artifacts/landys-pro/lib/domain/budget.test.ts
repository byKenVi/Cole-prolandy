import { describe, expect, it } from "vitest";
import { parseBudgetToCents, resolveBudgetCents } from "./budget";
import { resolveTierFromBudget } from "./tier-resolution";

describe("budget normalization", () => {
  it("parses unambiguous currency strings", () => {
    expect(parseBudgetToCents("$5,000")).toEqual({
      ok: true,
      budgetCents: 500000,
      budgetRaw: "$5,000",
    });
    expect(parseBudgetToCents("5000.00")).toEqual({
      ok: true,
      budgetCents: 500000,
      budgetRaw: "5000.00",
    });
  });

  it("rejects fuzzy budget language", () => {
    expect(parseBudgetToCents("around 10k").ok).toBe(false);
    expect(parseBudgetToCents("$10,000-$20,000").ok).toBe(false);
  });

  it("prefers structured budgetCents", () => {
    expect(resolveBudgetCents({ budgetCents: 1500000, budget: "$15,000" })).toEqual({
      ok: true,
      budgetCents: 1500000,
      budgetRaw: "$15,000",
    });
  });
});

describe("tier resolution boundaries", () => {
  const thresholds = { tier1MaxBudgetCents: 500000, tier2MaxBudgetCents: 1500000 };

  it("assigns tiers at exact boundaries", () => {
    expect(resolveTierFromBudget(500000, thresholds)).toBe(1);
    expect(resolveTierFromBudget(500001, thresholds)).toBe(2);
    expect(resolveTierFromBudget(1500000, thresholds)).toBe(2);
    expect(resolveTierFromBudget(1500001, thresholds)).toBe(3);
  });
});
