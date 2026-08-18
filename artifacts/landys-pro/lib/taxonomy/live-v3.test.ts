import { describe, expect, it } from "vitest";
import {
  normalizeLiveBudgetBand,
  normalizeLiveCategoryCode,
  normalizeLiveLandTypeCode,
  normalizeLiveTimelineCode,
  normalizeLiveUrgencyCode,
  normalizeLiveWorkTypeCode,
} from "@/lib/taxonomy/live-v3";
import { inferBudgetBandFromCents, resolveLeadBudget } from "@/lib/domain/budget";

describe("live v3 taxonomy normalization", () => {
  it("accepts canonical codes and Wix labels for categories", () => {
    expect(normalizeLiveCategoryCode("roofing")).toBe("roofing");
    expect(normalizeLiveCategoryCode("General Contractor")).toBe("general-contractor");
    expect(normalizeLiveCategoryCode("Landscaping")).toBe("landscaping");
  });

  it("accepts work type labels and codes", () => {
    expect(normalizeLiveWorkTypeCode("new-build")).toBe("new-build");
    expect(normalizeLiveWorkTypeCode("Renovation / Remodel")).toBe("renovation-remodel");
  });

  it("accepts land type labels and codes", () => {
    expect(normalizeLiveLandTypeCode("residential")).toBe("residential");
    expect(normalizeLiveLandTypeCode("Rural / Land")).toBe("rural-land");
  });

  it("normalizes timeline and urgency values", () => {
    expect(normalizeLiveTimelineCode("ASAP")).toBe("asap");
    expect(normalizeLiveTimelineCode("Within 30 days")).toBe("within-1-month");
    expect(normalizeLiveUrgencyCode("High")).toBe("high");
  });

  it("normalizes budget band labels without inventing exact cents", () => {
    expect(normalizeLiveBudgetBand("Under $5K")).toBe("UNDER_5K");
    expect(normalizeLiveBudgetBand("$5,000–$15,000")).toBe("BETWEEN_5K_15K");
    const band = resolveLeadBudget({ budget: "Under $5K" });
    expect(band.ok && band.kind === "band" ? band.budgetBand : null).toBe("UNDER_5K");
  });

  it("keeps exact budgetCents compatibility", () => {
    const exact = resolveLeadBudget({ budgetCents: 1_000_000, budget: "$10,000" });
    expect(exact.ok && exact.kind === "exact" ? exact.budgetCents : null).toBe(1_000_000);
  });

  it("maps exact cents to bands for tier lookup without fabricating cents from bands", () => {
    expect(inferBudgetBandFromCents(400_000)).toBe("UNDER_5K");
    expect(inferBudgetBandFromCents(800_000)).toBe("BETWEEN_5K_15K");
  });

  it("does not auto-create taxonomy from unknown strings", () => {
    expect(normalizeLiveCategoryCode("Mystery Trade")).toBeNull();
    expect(normalizeLiveWorkTypeCode("Patio Installation")).toBeNull();
  });
});
