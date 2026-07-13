import { describe, expect, it } from "vitest";
import {
  computeSafeToWithdraw,
  netLeadRevenueCents,
  stripeAvailableUsdCents,
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

describe("computeSafeToWithdraw", () => {
  it("matches top-up then lead purchase (200 in, 80 sold)", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 12_000,
      stripeAvailableCents: 20_000,
    });
    expect(r.safeToWithdrawCents).toBe(8_000);
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
    expect(r.uncoveredLiabilityCents).toBe(0);
  });

  it("flags uncovered liability when wallets exceed Stripe cash", () => {
    const r = computeSafeToWithdraw({
      netLeadRevenueCents: 8_000,
      heldForContractorsCents: 15_000,
      stripeAvailableCents: 10_000,
    });
    expect(r.safeToWithdrawCents).toBe(0);
    expect(r.uncoveredLiabilityCents).toBe(5_000);
  });
});

describe("stripeAvailableUsdCents", () => {
  it("prefers usd", () => {
    expect(
      stripeAvailableUsdCents([
        { amountCents: 100, currency: "eur" },
        { amountCents: 500, currency: "usd" },
      ]),
    ).toBe(500);
  });

  it("sums when no usd", () => {
    expect(
      stripeAvailableUsdCents([
        { amountCents: 100, currency: "eur" },
        { amountCents: 50, currency: "cad" },
      ]),
    ).toBe(150);
  });
});
