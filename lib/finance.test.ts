import { describe, expect, it } from "vitest";
import {
  cashHeldForContractorsCents,
  computeSafeToWithdraw,
  estimateStripeFeesCents,
  netLeadRevenueCents,
  stripeUsdCents,
} from "./finance";

describe("netLeadRevenueCents", () => {
  it("uses absolute lead charges", () => {
    expect(netLeadRevenueCents(-150_500, 0)).toBe(150_500);
    expect(netLeadRevenueCents(150_500, 0)).toBe(150_500);
  });

  it("subtracts internal lead refunds", () => {
    expect(netLeadRevenueCents(-10_000, 3_000)).toBe(7_000);
  });

  it("never goes negative", () => {
    expect(netLeadRevenueCents(-5_000, 8_000)).toBe(0);
  });
});

describe("estimateStripeFeesCents", () => {
  it("applies 2.9% plus 30c per top-up", () => {
    expect(estimateStripeFeesCents(10_000, 1)).toBe(290 + 30);
    expect(estimateStripeFeesCents(20_000, 2)).toBe(580 + 60);
  });
});

describe("cashHeldForContractorsCents", () => {
  it("excludes promo grants from held", () => {
    expect(cashHeldForContractorsCents(15_000, 5_000)).toBe(10_000);
  });

  it("floors at zero", () => {
    expect(cashHeldForContractorsCents(1_000, 5_000)).toBe(0);
  });
});

describe("computeSafeToWithdraw", () => {
  it("matches top-up then lead purchase (200 in, 80 sold)", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 12_000,
      stripeAvailableCents: 20_000,
    });
    expect(r.safeToWithdrawCents).toBe(8_000);
    expect(r.safeAfterPendingCents).toBe(8_000);
    expect(r.uncoveredLiabilityCents).toBe(0);
  });

  it("is zero while prepaid is unspent", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 0,
      heldForContractorsCents: 20_000,
      stripeAvailableCents: 20_000,
    });
    expect(r.safeToWithdrawCents).toBe(0);
  });

  it("drops after a bank payout of earned cash", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 12_000,
      stripeAvailableCents: 12_000,
    });
    expect(r.safeToWithdrawCents).toBe(0);
  });

  it("caps by Stripe fees (cash less than lead CA)", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 12_000,
      stripeAvailableCents: 19_400,
    });
    expect(r.safeToWithdrawCents).toBe(7_400);
  });

  it("returns null safe amount when Stripe is unavailable", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 12_000,
      stripeAvailableCents: null,
    });
    expect(r.safeToWithdrawCents).toBeNull();
    expect(r.safeAfterPendingCents).toBeNull();
    expect(r.uncoveredLiabilityCents).toBe(0);
  });

  it("uses pending for after-settle safe and coverage", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 15_000,
      stripeAvailableCents: 10_000,
      stripePendingCents: 6_000,
    });
    // Now: available 10k − held 15k → 0
    expect(r.safeToWithdrawCents).toBe(0);
    // After pending: 16k − 15k = 1k
    expect(r.safeAfterPendingCents).toBe(1_000);
    expect(r.uncoveredLiabilityCents).toBe(0);
  });

  it("flags uncovered when available+pending still short", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 15_000,
      stripeAvailableCents: 10_000,
      stripePendingCents: 2_000,
    });
    expect(r.safeToWithdrawCents).toBe(0);
    expect(r.safeAfterPendingCents).toBe(0);
    expect(r.uncoveredLiabilityCents).toBe(3_000);
  });
});

describe("stripeUsdCents", () => {
  it("prefers usd", () => {
    expect(
      stripeUsdCents([
        { amountCents: 100, currency: "eur" },
        { amountCents: 500, currency: "usd" },
      ]),
    ).toBe(500);
  });

  it("sums when no usd", () => {
    expect(
      stripeUsdCents([
        { amountCents: 100, currency: "eur" },
        { amountCents: 50, currency: "cad" },
      ]),
    ).toBe(150);
  });
});
