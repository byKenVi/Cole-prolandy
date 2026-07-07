import { describe, it, expect } from "vitest";
import {
  validateTopUpAmountCents,
  TOPUP_MIN_CENTS,
  TOPUP_MAX_CENTS,
  TOPUP_PRESETS_CENTS,
} from "./topup";

describe("validateTopUpAmountCents", () => {
  it("accepts all presets ($50 / $100 / $250)", () => {
    expect(TOPUP_PRESETS_CENTS).toEqual([5000, 10000, 25000]);
    for (const cents of TOPUP_PRESETS_CENTS) {
      const res = validateTopUpAmountCents(cents);
      expect(res.ok).toBe(true);
    }
  });

  it("accepts a valid custom amount at the boundaries", () => {
    expect(validateTopUpAmountCents(TOPUP_MIN_CENTS).ok).toBe(true);
    expect(validateTopUpAmountCents(TOPUP_MAX_CENTS).ok).toBe(true);
    expect(validateTopUpAmountCents(13000).ok).toBe(true); // $130
  });

  it("rejects below the minimum", () => {
    const res = validateTopUpAmountCents(TOPUP_MIN_CENTS - 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/Minimum/);
  });

  it("rejects above the maximum", () => {
    const res = validateTopUpAmountCents(TOPUP_MAX_CENTS + 1);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.message).toMatch(/Maximum/);
  });

  it("rejects non-integer and zero/negative amounts", () => {
    expect(validateTopUpAmountCents(50.5).ok).toBe(false);
    expect(validateTopUpAmountCents(0).ok).toBe(false);
    expect(validateTopUpAmountCents(-5000).ok).toBe(false);
  });
});
