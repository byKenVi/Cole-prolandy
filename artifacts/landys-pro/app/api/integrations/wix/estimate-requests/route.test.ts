import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/domain/errors";
import { WIX_ESTIMATE_REQUEST_SOURCE } from "@/lib/integrations/wix/estimate-contract";

const createOfficialEstimateRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/lead-intake", () => {
  class LeadIntakeConflictError extends Error {
    constructor() {
      super("The external request ID was already used with a different payload.");
    }
  }
  return { createOfficialEstimateRequest, LeadIntakeConflictError };
});

import { LeadIntakeConflictError } from "@/lib/services/lead-intake";
import { POST } from "./route";

const VALID_REQUEST = {
  source: WIX_ESTIMATE_REQUEST_SOURCE.GENERAL,
  externalRequestId: "request-123",
  email: "landowner@example.com",
  propertyZip: "78701",
  landTypeCode: "development",
  projectTypeCode: "culvert-install",
  budget: "$10,000-$20,000",
  timeline: "2026-10-01",
  urgency: "Within 30 days",
  description: "Install a new culvert at the property entrance.",
};

function request(body: unknown, secret = "test-secret") {
  return new NextRequest("https://landys.example/api/integrations/wix/estimate-requests", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST Wix estimate request", () => {
  beforeEach(() => {
    vi.stubEnv("WIX_ESTIMATE_INTEGRATION_ENABLED", "true");
    vi.stubEnv("WIX_ESTIMATE_API_SECRET", "test-secret");
    createOfficialEstimateRequest.mockReset();
    createOfficialEstimateRequest.mockResolvedValue({
      leadId: "lead-1",
      replay: false,
      reviewStatus: "pending_review",
      blockers: ["tier_review"],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("authenticates before creating a lead", async () => {
    const response = await POST(request(VALID_REQUEST, "wrong-secret"));
    expect(response.status).toBe(401);
    expect(createOfficialEstimateRequest).not.toHaveBeenCalled();
  });

  it("creates a general request through the shared intake service", async () => {
    const response = await POST(request(VALID_REQUEST));
    expect(response.status).toBe(202);
    expect(createOfficialEstimateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "wix",
        externalRequestId: "request-123",
        routing: { mode: "general" },
      }),
    );
  });

  it("sends direct requests only to the mapped external contractor path", async () => {
    const response = await POST(
      request({
        ...VALID_REQUEST,
        source: WIX_ESTIMATE_REQUEST_SOURCE.DIRECT,
        externalContractorId: "contractor-7",
      }),
    );
    expect(response.status).toBe(202);
    expect(createOfficialEstimateRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "wix",
        routing: {
          mode: "direct",
          contractorSource: "wix",
          contractorExternalId: "contractor-7",
        },
      }),
    );
  });

  it("returns an explicit conflict for a materially changed replay", async () => {
    createOfficialEstimateRequest.mockRejectedValue(new LeadIntakeConflictError());
    const response = await POST(request(VALID_REQUEST));
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("idempotency_conflict");
  });

  it("fails unknown taxonomy references safely", async () => {
    createOfficialEstimateRequest.mockRejectedValue(
      new DomainError("INVALID_REFERENCE", "Unknown or inactive project type."),
    );
    const response = await POST(request(VALID_REQUEST));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("invalid_reference");
  });

  it("reports an identical retry without creating an alternate response shape", async () => {
    createOfficialEstimateRequest.mockResolvedValue({
      leadId: "lead-1",
      replay: true,
      reviewStatus: "pending_review",
      blockers: ["tier_review"],
    });
    const response = await POST(request(VALID_REQUEST));
    const body = await response.json();
    expect(response.status).toBe(202);
    expect(body.data).toEqual(
      expect.objectContaining({ leadId: "lead-1", replay: true }),
    );
  });
});
