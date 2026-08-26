import {
  LeadReviewStatus,
  LeadRoutingMode,
  LeadStatus,
} from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";
import { NotFoundError } from "@/lib/domain/errors";

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  notifyNewLead: vi.fn(),
  ingestLeadAttachments: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: new Proxy({} as Record<string, unknown>, {
    get(_target, property: string) {
      const target = h.db as unknown as Record<string, unknown>;
      const value = target[property];
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(h.db)
        : value;
    },
  }),
}));

vi.mock("@/lib/notifications", () => ({
  notifyNewLead: h.notifyNewLead,
}));

vi.mock("@/lib/services/lead-attachments", () => ({
  ingestLeadAttachments: h.ingestLeadAttachments,
}));

vi.mock("@/lib/integrations/wix/contractor-id-resolver", () => ({
  resolveWixContractorExternalId: vi.fn(async (_db: unknown, id: string) => ({
    externalId: id,
    usedDeprecatedAlias: false,
  })),
}));

import {
  createAndDistributeLead,
  createOfficialEstimateRequest,
  finalizeLeadForRouting,
  LeadIntakeConflictError,
  type OfficialEstimateIntakeInput,
} from "./lead-intake";

function seedTaxonomies(db: FakeDb) {
  db.projectType.seed([
    {
      id: "project-1",
      code: "culvert-install",
      name: "CULVERT INSTALL",
      contractorTypeId: "trade-1",
      archivedAt: null,
    },
  ]);
  db.landType.seed([
    { id: "land-1", code: "development", name: "Development", archivedAt: null },
  ]);
  db.contractorCategory.seed([
    { id: "category-1", code: "builders", name: "Builders", archivedAt: null },
  ]);
  db.priceTier.seed([
    {
      id: "price-t1",
      contractorTypeId: "trade-1",
      projectTypeId: "project-1",
      tier: 1,
      priceCents: 3100,
      maxBudgetCents: 500000,
    },
    {
      id: "price-t2",
      contractorTypeId: "trade-1",
      projectTypeId: "project-1",
      tier: 2,
      priceCents: 4200,
      maxBudgetCents: 1500000,
    },
    {
      id: "price-t3",
      contractorTypeId: "trade-1",
      projectTypeId: "project-1",
      tier: 3,
      priceCents: 5300,
      maxBudgetCents: null,
    },
  ]);
}

function input(
  overrides: Partial<OfficialEstimateIntakeInput> = {},
): OfficialEstimateIntakeInput {
  return {
    firstName: " Jordan ",
    lastName: " Lee ",
    phone: null,
    email: "LANDOWNER@example.com",
    propertyZip: "78701",
    contractorCategoryCode: "builders",
    landTypeCode: "development",
    projectTypeCode: "culvert-install",
    budget: "$10,000",
    budgetCents: 1000000,
    timeline: new Date("2026-10-01T00:00:00.000Z"),
    urgency: "Within 30 days",
    description: "Install a new culvert at the property entrance.",
    source: "wix",
    externalRequestId: "request-123",
    payloadHash: "hash-123",
    routing: { mode: "general" },
    ...overrides,
  };
}

describe("official estimate intake", () => {
  beforeEach(() => {
    h.db = createFakeDb();
    seedTaxonomies(h.db);
    h.notifyNewLead.mockReset();
    h.ingestLeadAttachments.mockResolvedValue({ ingested: 0, failed: 0, hasFailures: false });
  });

  it("auto-routes when budgetCents resolves tier", async () => {
    h.db.contractor.seed(
      Array.from({ length: 10 }, (_, index) => ({
        id: `contractor-${index}`,
        name: `Contractor ${index}`,
        email: `contractor-${index}@example.com`,
        phone: `+1512555010${index}`,
        deactivatedAt: null,
        createdAt: new Date(index),
        projects: [{ contractorTypeId: "trade-1" }],
        contractorCategoryId: "category-1",
      })),
    );

    const result = await createOfficialEstimateRequest(input());

    expect(result.reviewStatus).toBe("routed");
    expect(result.blockers).not.toContain("budget_review");
    expect(h.db.lead.rows[0]).toEqual(
      expect.objectContaining({
        budgetCents: 1000000,
        tier: 2,
        maxPurchases: 3,
      }),
    );
    expect(h.db.leadMatch.rows).toHaveLength(10);
    expect(h.notifyNewLead).toHaveBeenCalledTimes(10);
  });

  it("holds leads with unresolvable budget text", async () => {
    const result = await createOfficialEstimateRequest(
      input({ budget: "$10,000-$20,000", budgetCents: null }),
    );

    expect(result.blockers).toContain("budget_review");
    expect(h.db.lead.rows[0].budgetCents).toBeNull();
    expect(h.db.leadMatch.rows).toHaveLength(0);
  });

  it("replays an identical external request and rejects conflicting data", async () => {
    const first = await createOfficialEstimateRequest(
      input({ budget: "$10,000-$20,000", budgetCents: null }),
    );
    const replay = await createOfficialEstimateRequest(
      input({ budget: "$10,000-$20,000", budgetCents: null }),
    );

    expect(replay).toEqual(expect.objectContaining({ leadId: first.leadId, replay: true }));
    await expect(
      createOfficialEstimateRequest(input({ payloadHash: "changed-hash", budgetCents: null, budget: "$10,000-$20,000" })),
    ).rejects.toBeInstanceOf(LeadIntakeConflictError);
  });

  it("holds an unresolved direct contractor and never falls back to general matching", async () => {
    h.db.contractor.seed([
      {
        id: "general-candidate",
        name: "General Candidate",
        email: "general@example.com",
        phone: "+15125550100",
        deactivatedAt: null,
        createdAt: new Date(),
        projects: [{ contractorTypeId: "trade-1" }],
      },
    ]);

    const result = await createOfficialEstimateRequest(
      input({
        routing: {
          mode: "direct",
          contractorSource: "wix",
          contractorExternalId: "missing-contractor",
        },
      }),
    );

    expect(result.blockers).toEqual(["contractor_review"]);
    expect(h.db.leadMatch.rows).toHaveLength(0);
    expect(h.notifyNewLead).not.toHaveBeenCalled();
  });

  it("routes a direct request only to its mapped active contractor with maxPurchases=1", async () => {
    h.db.externalContractorIdentity.seed([
      {
        id: "identity-1",
        source: "wix",
        externalId: "wix-contractor-1",
        contractor: {
          id: "direct-contractor",
          name: "Mapped Contractor",
          email: "mapped@example.com",
          phone: "+15125550101",
          deactivatedAt: null,
        },
      },
    ]);
    h.db.contractor.seed([
      {
        id: "general-candidate",
        name: "General Candidate",
        email: "general@example.com",
        phone: "+15125550100",
        deactivatedAt: null,
        createdAt: new Date(),
        projects: [{ contractorTypeId: "trade-1" }],
      },
    ]);

    const created = await createOfficialEstimateRequest(
      input({
        routing: {
          mode: "direct",
          contractorSource: "wix",
          contractorExternalId: "wix-contractor-1",
        },
      }),
    );

    expect(created.reviewStatus).toBe("routed");
    expect(h.db.lead.rows[0].maxPurchases).toBe(1);
    expect(h.db.leadMatch.rows).toEqual([
      expect.objectContaining({ contractorId: "direct-contractor" }),
    ]);
    expect(h.notifyNewLead).toHaveBeenCalledTimes(1);
  });

  it("snapshots tier immutably after admin budget correction", async () => {
    const created = await createOfficialEstimateRequest(
      input({ budget: "not sure", budgetCents: null }),
    );
    const result = await finalizeLeadForRouting({
      leadId: created.leadId,
      budgetCents: 1000000,
    });
    h.db.priceTier.rows.find((t) => t.tier === 2)!.priceCents = 9900;
    const replay = await finalizeLeadForRouting({
      leadId: created.leadId,
      budgetCents: 1000000,
    });

    expect(result.recipients).toBeGreaterThanOrEqual(0);
    expect(h.db.lead.rows[0].tier).toBe(2);
    expect(replay.recipients).toBe(0);
  });
});
