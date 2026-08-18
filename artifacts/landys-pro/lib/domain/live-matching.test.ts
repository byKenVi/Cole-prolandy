import { beforeEach, describe, expect, it } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";
import { distributeLead } from "@/lib/domain/leads";

function seedLiveLead(db: FakeDb) {
  db.contractorCategory.seed([
    { id: "cat-roofing", code: "roofing", name: "Roofing", archivedAt: null },
    { id: "cat-other", code: "other", name: "Other", archivedAt: null },
  ]);
  db.workType.seed([{ id: "wt-repair", code: "repair", name: "Repair", archivedAt: null }]);
  db.lead.seed([
    {
      id: "lead-live",
      workTypeId: "wt-repair",
      projectTypeId: null,
      contractorCategoryId: "cat-roofing",
      tier: 2,
      priceCents: 4200,
      expiresAt: new Date(Date.now() + 3600_000),
      tierReviewRequired: false,
      budgetReviewRequired: false,
      pricingReviewRequired: false,
      contractorReviewRequired: false,
      status: "NEW",
      matches: [],
    },
  ]);
}

describe("live lead matching", () => {
  let db: FakeDb;

  beforeEach(() => {
    db = createFakeDb();
    seedLiveLead(db);
  });

  it("requires category match and treats empty work types as category generalists", async () => {
    db.contractor.seed([
      {
        id: "generalist",
        name: "Roof Generalist",
        email: "generalist@example.com",
        phone: "+15125550100",
        deactivatedAt: null,
        createdAt: new Date(0),
        contractorCategoryId: "cat-roofing",
        workTypes: [],
      },
      {
        id: "specialist",
        name: "Roof Repair Only",
        email: "specialist@example.com",
        phone: "+15125550101",
        deactivatedAt: null,
        createdAt: new Date(1),
        contractorCategoryId: "cat-roofing",
        workTypes: [{ workTypeId: "wt-repair" }],
      },
      {
        id: "wrong-work",
        name: "Roof Install Only",
        email: "install@example.com",
        phone: "+15125550102",
        deactivatedAt: null,
        createdAt: new Date(2),
        contractorCategoryId: "cat-roofing",
        workTypes: [{ workTypeId: "wt-install" }],
      },
    ]);

    const result = await distributeLead(db, "lead-live");
    expect(result.matches.map((m) => m.contractorId).sort()).toEqual(["generalist", "specialist"]);
  });

  it("excludes contractors without a resolved category", async () => {
    db.contractor.seed([
      {
        id: "no-category",
        name: "No Category",
        email: "none@example.com",
        phone: "+15125550103",
        deactivatedAt: null,
        createdAt: new Date(0),
        contractorCategoryId: null,
        workTypes: [],
      },
    ]);

    const result = await distributeLead(db, "lead-live");
    expect(result.matches).toHaveLength(0);
  });
});
