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
    budget: "$10,000-$20,000",
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
  });

  it("stores faithful raw fields in pending review without pricing or distribution", async () => {
    const result = await createOfficialEstimateRequest(input());
    const lead = h.db.lead.rows[0];

    expect(result).toEqual({
      leadId: lead.id,
      replay: false,
      reviewStatus: "pending_review",
      blockers: ["tier_review"],
    });
    expect(lead).toEqual(
      expect.objectContaining({
        landownerName: "Jordan Lee",
        landownerEmail: "landowner@example.com",
        propertyZip: "78701",
        budget: "$10,000-$20,000",
        urgency: "Within 30 days",
        tier: null,
        priceCents: null,
        expiresAt: null,
        reviewStatus: LeadReviewStatus.PENDING_REVIEW,
        tierReviewRequired: true,
        contractorReviewRequired: false,
        routingMode: LeadRoutingMode.GENERAL,
      }),
    );
    expect(h.db.leadMatch.rows).toHaveLength(0);
    expect(h.notifyNewLead).not.toHaveBeenCalled();
  });

  it("replays an identical external request and rejects conflicting data", async () => {
    const first = await createOfficialEstimateRequest(input());
    const replay = await createOfficialEstimateRequest(input());

    expect(replay).toEqual(expect.objectContaining({ leadId: first.leadId, replay: true }));
    expect(h.db.lead.rows).toHaveLength(1);
    await expect(
      createOfficialEstimateRequest(input({ payloadHash: "changed-hash" })),
    ).rejects.toBeInstanceOf(LeadIntakeConflictError);
    expect(h.db.lead.rows).toHaveLength(1);
  });

  it("rejects inactive taxonomy codes before creating a lead", async () => {
    h.db.projectType.rows[0].archivedAt = new Date();

    await expect(createOfficialEstimateRequest(input())).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(h.db.lead.rows).toHaveLength(0);
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

    expect(result.blockers).toEqual(["tier_review", "contractor_review"]);
    expect(h.db.lead.rows[0]).toEqual(
      expect.objectContaining({
        routingMode: LeadRoutingMode.DIRECT,
        contractorReviewRequired: true,
      }),
    );
    expect(h.db.leadMatch.rows).toHaveLength(0);
    expect(h.notifyNewLead).not.toHaveBeenCalled();
  });

  it("snapshots a resolved tier price once while an unknown direct contractor remains held", async () => {
    const created = await createOfficialEstimateRequest(
      input({
        routing: {
          mode: "direct",
          contractorSource: "wix",
          contractorExternalId: "missing-contractor",
        },
      }),
    );
    h.db.priceTier.seed([
      {
        id: "price-1",
        contractorTypeId: "trade-1",
        projectTypeId: "project-1",
        tier: 2,
        priceCents: 4200,
      },
    ]);

    const first = await finalizeLeadForRouting({
      leadId: created.leadId,
      tier: 2,
      actorId: "admin@example.com",
    });
    h.db.priceTier.rows[0].priceCents = 9900;
    const replay = await finalizeLeadForRouting({
      leadId: created.leadId,
      tier: 2,
      actorId: "admin@example.com",
    });

    expect(first).toEqual(
      expect.objectContaining({
        priceCents: 4200,
        recipients: 0,
        heldForContractorReview: true,
      }),
    );
    expect(replay.priceCents).toBe(4200);
    expect(h.db.lead.rows[0].priceCents).toBe(4200);
    expect(h.db.lead.rows[0].expiresAt).toBeNull();
    expect(h.db.lead.rows[0].status).toBe(LeadStatus.NEW);
    expect(h.notifyNewLead).not.toHaveBeenCalled();
  });

  it("routes a direct request only to its mapped active contractor", async () => {
    const mapped = {
      id: "direct-contractor",
      name: "Mapped Contractor",
      email: "mapped@example.com",
      phone: "+15125550101",
      deactivatedAt: null,
    };
    h.db.externalContractorIdentity.seed([
      {
        id: "identity-1",
        source: "wix",
        externalId: "wix-contractor-1",
        contractor: mapped,
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
    h.db.priceTier.seed([
      {
        id: "price-1",
        contractorTypeId: "trade-1",
        projectTypeId: "project-1",
        tier: 1,
        priceCents: 3100,
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

    const result = await finalizeLeadForRouting({ leadId: created.leadId, tier: 1 });

    expect(result.recipients).toBe(1);
    expect(h.db.leadMatch.rows).toEqual([
      expect.objectContaining({ contractorId: "direct-contractor" }),
    ]);
    expect(h.db.lead.rows[0].reviewStatus).toBe(LeadReviewStatus.ROUTED);
    expect(h.notifyNewLead).toHaveBeenCalledTimes(1);
  });

  it("rejects archived project types on the admin compatibility path", async () => {
    h.db.projectType.seed([
      {
        id: "archived-project",
        code: "legacy-project",
        name: "Legacy",
        contractorTypeId: "trade-1",
        archivedAt: new Date(),
      },
    ]);

    await expect(
      createAndDistributeLead({
        landownerName: "Jordan Lee",
        landownerEmail: "jordan@example.com",
        landownerPhone: "+15125550100",
        propertyLocation: "78701",
        projectTypeId: "archived-project",
        tier: 1,
        source: "admin_manual",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
