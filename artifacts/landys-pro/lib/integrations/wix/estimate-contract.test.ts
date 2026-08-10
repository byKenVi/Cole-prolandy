import { describe, expect, it } from "vitest";
import {
  hasValidBearerSecret,
  WixEstimateRequestSchema,
  wixEstimatePayloadHash,
} from "./estimate-contract";

const VALID_REQUEST = {
  source: "wix",
  externalRequestId: "request-123",
  firstName: null,
  lastName: null,
  phone: null,
  email: "landowner@example.com",
  propertyZip: "78701",
  contractorCategoryCode: null,
  landTypeCode: "development",
  projectTypeCode: "culvert-install",
  budget: "$10,000-$20,000",
  timeline: "2026-10-01",
  urgency: "Within 30 days",
  description: "Install a new culvert at the property entrance.",
  routingMode: "general",
} as const;

describe("Wix estimate contract", () => {
  it("accepts the supported general request without optional identity fields", () => {
    expect(WixEstimateRequestSchema.safeParse(VALID_REQUEST).success).toBe(true);
  });

  it("requires a contractor ID only for direct routing", () => {
    expect(
      WixEstimateRequestSchema.safeParse({
        ...VALID_REQUEST,
        routingMode: "direct",
      }).success,
    ).toBe(false);
    expect(
      WixEstimateRequestSchema.safeParse({
        ...VALID_REQUEST,
        routingMode: "direct",
        directContractorExternalId: "contractor-7",
      }).success,
    ).toBe(true);
  });

  it("rejects attachment and other undocumented fields", () => {
    expect(
      WixEstimateRequestSchema.safeParse({
        ...VALID_REQUEST,
        attachmentUrl: "https://example.com/file.pdf",
      }).success,
    ).toBe(false);
  });

  it("creates a stable hash and changes it when the canonical payload changes", () => {
    const payload = WixEstimateRequestSchema.parse(VALID_REQUEST);
    expect(wixEstimatePayloadHash(payload)).toBe(wixEstimatePayloadHash({ ...payload }));
    expect(
      wixEstimatePayloadHash({ ...payload, urgency: "Immediately" }),
    ).not.toBe(wixEstimatePayloadHash(payload));
  });

  it("validates bearer credentials without direct string comparison", () => {
    expect(hasValidBearerSecret("Bearer shared-secret", "shared-secret")).toBe(true);
    expect(hasValidBearerSecret("Bearer wrong", "shared-secret")).toBe(false);
    expect(hasValidBearerSecret(null, "shared-secret")).toBe(false);
    expect(hasValidBearerSecret("Bearer shared-secret", undefined)).toBe(false);
  });
});
