import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb, type FakeDb } from "@/lib/domain/__fixtures__/fakeDb";

const h = vi.hoisted(() => ({
  db: null as unknown as FakeDb,
  notifyContractorsOfNewLead: vi.fn(),
  notifyAdmins: vi.fn(),
  ingestLeadAttachments: vi.fn(),
  syncWixContractorById: vi.fn(),
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
  notifyContractorsOfNewLead: h.notifyContractorsOfNewLead,
  notifyAdmins: h.notifyAdmins,
}));

vi.mock("@/lib/services/lead-attachments", () => ({
  ingestLeadAttachments: h.ingestLeadAttachments,
}));

vi.mock("@/lib/integrations/wix/contractor-sync", () => ({
  syncWixContractorById: h.syncWixContractorById,
}));

vi.mock("@/lib/integrations/wix/contractor-id-resolver", () => ({
  resolveWixContractorExternalId: vi.fn(async (_db: unknown, id: string) => ({
    externalId: id,
    usedDeprecatedAlias: false,
  })),
}));

import {
  createOfficialEstimateRequest,
  LeadIntakeConflictError,
  type OfficialEstimateIntakeInput,
} from "./lead-intake";

/** The "Get Three Estimates" payload from landys.co's Payload Reference Guide. */
function generalPayload(overrides: Partial<OfficialEstimateIntakeInput> = {}): OfficialEstimateIntakeInput {
  return {
    firstName: "test",
    lastName: "test",
    phone: "(555) 555-0100",
    email: "test@gmail.com",
    propertyZip: "75948",
    contractorCategoryCode: "roofing",
    projectTypeCode: "new-build",
    landTypeCode: "residential",
    budget: "under-5k",
    timelineRaw: "within-2-weeks",
    timeline: null,
    urgency: "medium",
    description: "This is test example",
    attachments: [],
    source: "wix",
    externalRequestId: "wix-estimate-1787750301324-dx2qhza",
    payloadHash: "hash-general",
    routing: { mode: "general" },
    ...overrides,
  };
}

function roofer(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    email: `${id}@example.com`,
    phone: "+15125550100",
    deactivatedAt: null,
    leadsPausedUntil: null,
    createdAt: new Date(0),
    contractorCategoryId: "cat-roofing",
    serviceZipCodes: ["75948"],
    serviceCounties: [],
    serviceRadiusMiles: null,
    ...extra,
  };
}

describe("official estimate intake (success-fee model)", () => {
  beforeEach(() => {
    h.db = createFakeDb();
    h.db.contractorCategory.seed([{ id: "cat-roofing", code: "roofing", name: "Roofing", archivedAt: null }]);
    h.notifyContractorsOfNewLead.mockReset();
    h.notifyAdmins.mockReset();
    h.syncWixContractorById.mockReset();
    h.ingestLeadAttachments.mockResolvedValue({ ingested: 0, failed: 0, hasFailures: false });
  });

  it("routes the PDF general payload to nearby roofers and understands the budget slug", async () => {
    h.db.contractor.seed([roofer("near-1"), roofer("near-2"), roofer("far", { serviceZipCodes: ["75204"] })]);

    const result = await createOfficialEstimateRequest(generalPayload());

    expect(result.reviewStatus).toBe("routed");
    expect(result.blockers).toEqual([]);
    expect(result.recipients).toBe(2);
    const lead = h.db.lead.rows[0];
    expect(lead).toEqual(expect.objectContaining({ budgetBand: "UNDER_5K", maxPurchases: 3, timelineCode: "within-2-weeks" }));
    expect(h.db.leadMatch.rows.map((m) => m.contractorId).sort()).toEqual(["near-1", "near-2"]);
    expect(h.notifyContractorsOfNewLead).toHaveBeenCalledTimes(1);
    expect(h.notifyContractorsOfNewLead.mock.calls[0][1]).toHaveLength(2);
  });

  it("creates taxonomy it has never seen instead of rejecting the request", async () => {
    const result = await createOfficialEstimateRequest(
      generalPayload({ contractorCategoryCode: "Land Lenders", projectTypeCode: "Patio Installation", landTypeCode: "Large Lots" }),
    );
    expect(h.db.contractorCategory.rows.map((c) => c.code)).toContain("land-lenders");
    expect(h.db.workType.rows.map((w) => w.code)).toContain("patio-installation");
    expect(h.db.landType.rows.map((l) => l.code)).toContain("large-lots");
    // Nobody in that category yet: held for the admin, who is alerted.
    expect(result.reviewStatus).toBe("pending_review");
    expect(result.blockers).toEqual(["no_matching_contractor"]);
    expect(h.db.lead.rows[0].reviewBlocker).toBe("NO_ELIGIBLE_CONTRACTORS");
    expect(h.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it("never blocks routing on a budget it cannot read", async () => {
    h.db.contractor.seed([roofer("near-1")]);
    const result = await createOfficialEstimateRequest(generalPayload({ budget: "depends on the quote" }));
    expect(result.reviewStatus).toBe("routed");
    expect(h.db.lead.rows[0].budget).toBe("depends on the quote");
    expect(h.db.lead.rows[0].budgetBand ?? null).toBeNull();
  });

  it("replays an identical request and rejects a conflicting one", async () => {
    h.db.contractor.seed([roofer("near-1")]);
    const first = await createOfficialEstimateRequest(generalPayload());
    const replay = await createOfficialEstimateRequest(generalPayload());
    expect(replay).toEqual(expect.objectContaining({ leadId: first.leadId, replay: true, reviewStatus: "routed" }));
    expect(h.db.lead.rows).toHaveLength(1);
    await expect(createOfficialEstimateRequest(generalPayload({ payloadHash: "other" }))).rejects.toBeInstanceOf(
      LeadIntakeConflictError,
    );
  });

  it("holds an unknown direct contractor, tries a Wix fetch, and never falls back to general matching", async () => {
    h.db.contractor.seed([roofer("near-1")]);
    const result = await createOfficialEstimateRequest(
      generalPayload({
        externalRequestId: "wix-profile-estimate-1",
        routing: { mode: "direct", contractorSource: "wix", contractorExternalId: "a88cc8a3-9a1f-4247-bf26-fbb989167871" },
      }),
    );
    expect(h.syncWixContractorById).toHaveBeenCalledWith("a88cc8a3-9a1f-4247-bf26-fbb989167871");
    expect(result.blockers).toEqual(["contractor_review"]);
    expect(h.db.leadMatch.rows).toHaveLength(0);
    expect(h.notifyContractorsOfNewLead).not.toHaveBeenCalled();
    expect(h.notifyAdmins).toHaveBeenCalledTimes(1);
  });

  it("routes a direct request only to its contractor, wherever they work", async () => {
    h.db.externalContractorIdentity.seed([
      {
        id: "identity-1",
        source: "wix",
        externalId: "wix-contractor-1",
        contractor: { id: "direct-pro", name: "Direct Pro", email: "d@example.com", phone: "+15125550101", deactivatedAt: null },
      },
    ]);
    h.db.contractor.seed([roofer("near-1")]);
    const result = await createOfficialEstimateRequest(
      generalPayload({
        externalRequestId: "wix-profile-estimate-2",
        routing: { mode: "direct", contractorSource: "wix", contractorExternalId: "wix-contractor-1" },
      }),
    );
    expect(result.reviewStatus).toBe("routed");
    expect(h.db.lead.rows[0].maxPurchases).toBe(1);
    expect(h.db.leadMatch.rows).toEqual([expect.objectContaining({ contractorId: "direct-pro" })]);
  });
});
