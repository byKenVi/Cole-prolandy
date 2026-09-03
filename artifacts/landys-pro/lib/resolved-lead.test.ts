import { describe, expect, it } from "vitest";
import { hasResolvedLeadSnapshot } from "./resolved-lead";

describe("hasResolvedLeadSnapshot", () => {
  it("keeps V2 opportunities that intentionally have no legacy tier or lead price", () => {
    expect(
      hasResolvedLeadSnapshot({
        tier: null,
        priceCents: null,
        expiresAt: new Date("2026-09-10T00:00:00.000Z"),
      }),
    ).toBe(true);
  });

  it("rejects opportunities without a delivery expiration snapshot", () => {
    expect(
      hasResolvedLeadSnapshot({
        tier: null,
        priceCents: null,
        expiresAt: null,
      }),
    ).toBe(false);
  });
});
