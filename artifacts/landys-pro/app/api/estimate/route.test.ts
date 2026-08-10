import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/domain/errors";

const mocks = vi.hoisted(() => ({
  createOfficialEstimateRequest: vi.fn(),
  createAndDistributeLead: vi.fn(),
  getDefaultLeadTier: vi.fn(),
}));

vi.mock("@/lib/services/lead-intake", () => ({
  createOfficialEstimateRequest: mocks.createOfficialEstimateRequest,
  createAndDistributeLead: mocks.createAndDistributeLead,
}));
vi.mock("@/lib/domain/settings", () => ({
  getDefaultLeadTier: mocks.getDefaultLeadTier,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => true) }));

import { POST } from "./route";

const OFFICIAL_REQUEST = {
  schemaVersion: 2,
  firstName: "Jordan",
  lastName: "Lee",
  phone: null,
  email: "jordan@example.com",
  propertyZip: "78701",
  contractorCategoryCode: "builders",
  landTypeCode: "development",
  projectTypeCode: "culvert-install",
  budget: "$10,000-$20,000",
  timeline: "2026-10-01",
  urgency: "Within 30 days",
  description: "Install a new culvert at the property entrance.",
};

function request(body: unknown) {
  return new NextRequest("https://landys.example/api/estimate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST public estimate", () => {
  beforeEach(() => {
    vi.stubEnv("FORM_SPAM_PROTECTION", "false");
    mocks.createOfficialEstimateRequest.mockReset();
    mocks.createAndDistributeLead.mockReset();
    mocks.getDefaultLeadTier.mockReset();
    mocks.createOfficialEstimateRequest.mockResolvedValue({
      leadId: "lead-1",
      replay: false,
      reviewStatus: "pending_review",
      blockers: ["tier_review"],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends schema v2 through the shared unresolved-tier intake service", async () => {
    const response = await POST(request(OFFICIAL_REQUEST));

    expect(response.status).toBe(202);
    expect(mocks.createOfficialEstimateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "landys_estimate",
        projectTypeCode: "culvert-install",
        routing: { mode: "general" },
      }),
    );
    expect(mocks.getDefaultLeadTier).not.toHaveBeenCalled();
    expect(mocks.createAndDistributeLead).not.toHaveBeenCalled();
  });

  it("preserves the explicitly isolated legacy compatibility path", async () => {
    mocks.getDefaultLeadTier.mockResolvedValue(2);
    mocks.createAndDistributeLead.mockResolvedValue({
      leadId: "legacy-lead",
      priceCents: 4000,
      recipients: 3,
    });

    const response = await POST(
      request({
        name: "Jordan Lee",
        phone: "+15125550100",
        email: "jordan@example.com",
        location: "Austin, TX",
        projectTypeId: "project-1",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getDefaultLeadTier).toHaveBeenCalledTimes(1);
    expect(mocks.createAndDistributeLead).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 2, source: "wix_form" }),
    );
    expect(mocks.createOfficialEstimateRequest).not.toHaveBeenCalled();
  });

  it("returns a safe client error when an active taxonomy cannot be resolved", async () => {
    mocks.createOfficialEstimateRequest.mockRejectedValue(
      new NotFoundError("Active project type"),
    );

    const response = await POST(request(OFFICIAL_REQUEST));
    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe("Active project type not found.");
  });
});
