import { beforeEach, describe, expect, it } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";
import { distributeLead } from "@/lib/domain/leads";

// Lead in Hemphill, TX 75948 (Sabine County).
function seedLiveLead(db: FakeDb, zip = "75948") {
  db.contractorCategory.seed([
    { id: "cat-roofing", code: "roofing", name: "Roofing", archivedAt: null },
    { id: "cat-plumbing", code: "plumbing", name: "Plumbing", archivedAt: null },
  ]);
  db.workType.seed([{ id: "wt-repair", code: "repair", name: "Repair", archivedAt: null }]);
  db.lead.seed([
    {
      id: "lead-live",
      workTypeId: "wt-repair",
      projectTypeId: null,
      contractorCategoryId: "cat-roofing",
      propertyZip: zip,
      propertyLocation: zip,
      tier: 2,
      priceCents: 0,
      expiresAt: new Date(Date.now() + 3600_000),
      contractorReviewRequired: false,
      status: "NEW",
      matches: [],
    },
  ]);
}

function contractor(id: string, extra: Record<string, unknown>) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    phone: "+15125550100",
    deactivatedAt: null,
    leadsPausedUntil: null,
    createdAt: new Date(0),
    contractorCategoryId: "cat-roofing",
    serviceZipCodes: [],
    serviceCounties: [],
    serviceRadiusMiles: null,
    workTypes: [],
    ...extra,
  };
}

describe("live lead matching: category + service area", () => {
  let db: FakeDb;

  beforeEach(() => {
    db = createFakeDb();
    seedLiveLead(db);
  });

  it("sends only to contractors whose area covers the property", async () => {
    db.contractor.seed([
      // Jasper, TX 75951 is ~33 miles from Hemphill: inside the default 50-mile radius.
      contractor("nearby", { serviceZipCodes: ["75951"] }),
      // Dallas 75204 is ~200 miles away.
      contractor("far", { serviceZipCodes: ["75204"] }),
      // County match.
      contractor("county", { serviceCounties: ["Sabine County, TX"] }),
      // Right area, wrong trade.
      contractor("plumber", { contractorCategoryId: "cat-plumbing", serviceZipCodes: ["75948"] }),
      // Work types no longer restrict matching.
      contractor("installer", { serviceZipCodes: ["75948"], workTypes: [{ workTypeId: "wt-install" }] }),
      // Contractors without any area are only a fallback.
      contractor("no-area", {}),
    ]);

    const result = await distributeLead(db, "lead-live");
    expect(result.matches.map((m) => m.contractorId).sort()).toEqual(["county", "installer", "nearby"]);
    expect(result.usedFallback).toBe(false);
  });

  it("matches secondary categories through memberships", async () => {
    db.contractor.seed([
      contractor("multi-trade", {
        contractorCategoryId: "cat-plumbing",
        categoryMemberships: [{ categoryId: "cat-roofing" }],
        serviceZipCodes: ["75948"],
      }),
    ]);
    const result = await distributeLead(db, "lead-live");
    expect(result.matches.map((m) => m.contractorId)).toEqual(["multi-trade"]);
  });

  it("falls back to contractors without a service area when nobody nearby covers the lead", async () => {
    db.contractor.seed([
      contractor("far", { serviceZipCodes: ["75204"] }),
      contractor("no-area", {}),
    ]);
    const result = await distributeLead(db, "lead-live");
    expect(result.matches.map((m) => m.contractorId)).toEqual(["no-area"]);
    expect(result.usedFallback).toBe(true);
  });

  it("honours a contractor's own radius", async () => {
    db.contractor.seed([contractor("tight", { serviceZipCodes: ["75951"], serviceRadiusMiles: 10 })]);
    const result = await distributeLead(db, "lead-live");
    expect(result.matches).toHaveLength(0);
  });

  it("skips paused and deactivated contractors", async () => {
    db.contractor.seed([
      contractor("paused", { serviceZipCodes: ["75948"], leadsPausedUntil: new Date(Date.now() + 86400_000) }),
      contractor("pause-over", { serviceZipCodes: ["75948"], leadsPausedUntil: new Date(Date.now() - 1000) }),
      contractor("off", { serviceZipCodes: ["75948"], deactivatedAt: new Date() }),
    ]);
    const result = await distributeLead(db, "lead-live");
    expect(result.matches.map((m) => m.contractorId)).toEqual(["pause-over"]);
  });

  it("excludes contractors without the lead's category", async () => {
    db.contractor.seed([contractor("no-category", { contractorCategoryId: null, serviceZipCodes: ["75948"] })]);
    const result = await distributeLead(db, "lead-live");
    expect(result.matches).toHaveLength(0);
  });
});
