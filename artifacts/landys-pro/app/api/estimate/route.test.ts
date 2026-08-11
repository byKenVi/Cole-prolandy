import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/domain/errors";

const mocks = vi.hoisted(() => ({
  createOfficialEstimateRequest: vi.fn(),
}));

vi.mock("@/lib/services/lead-intake", () => ({
  createOfficialEstimateRequest: mocks.createOfficialEstimateRequest,
}));
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
  });

  it("rejects schema v1 requests", async () => {
    const response = await POST(
      request({
        name: "Jordan Lee",
        phone: "+15125550100",
        email: "jordan@example.com",
        location: "Austin, TX",
        projectTypeId: "project-1",
      }),
    );

    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("schema_version_required");
    expect(mocks.createOfficialEstimateRequest).not.toHaveBeenCalled();
  });

  it("returns a structured client error when an active taxonomy cannot be resolved", async () => {
    mocks.createOfficialEstimateRequest.mockRejectedValue(
      new NotFoundError("Active project type"),
    );

    const response = await POST(request(OFFICIAL_REQUEST));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toEqual({
      code: "invalid_reference",
      message: "Active project type not found.",
    });
  });
});
