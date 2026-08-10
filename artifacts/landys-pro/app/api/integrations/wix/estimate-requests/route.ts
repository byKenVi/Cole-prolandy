import { NextResponse, type NextRequest } from "next/server";
import { DomainError } from "@/lib/domain/errors";
import {
  createOfficialEstimateRequest,
  LeadIntakeConflictError,
} from "@/lib/services/lead-intake";
import {
  hasValidBearerSecret,
  WIX_ESTIMATE_REQUEST_SOURCE,
  WIX_ESTIMATE_SOURCE,
  WixEstimateRequestSchema,
  wixEstimatePayloadHash,
} from "@/lib/integrations/wix/estimate-contract";

export async function POST(request: NextRequest) {
  if (process.env.WIX_ESTIMATE_INTEGRATION_ENABLED !== "true") {
    return NextResponse.json(
      { ok: false, error: { code: "integration_disabled", message: "Integration disabled." } },
      { status: 503 },
    );
  }

  if (
    !hasValidBearerSecret(
      request.headers.get("authorization"),
      process.env.WIX_ESTIMATE_API_SECRET,
    )
  ) {
    return NextResponse.json(
      { ok: false, error: { code: "unauthorized", message: "Invalid bearer credentials." } },
      { status: 401 },
    );
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "unsupported_media_type", message: "Content-Type must be application/json." },
      },
      { status: 415 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "invalid_json", message: "Request body is not valid JSON." } },
      { status: 400 },
    );
  }

  const parsed = WixEstimateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  const payload = parsed.data;
  try {
    const result = await createOfficialEstimateRequest({
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
      email: payload.email,
      propertyZip: payload.propertyZip,
      contractorCategoryCode: payload.contractorCategoryCode,
      landTypeCode: payload.landTypeCode,
      projectTypeCode: payload.projectTypeCode,
      budget: payload.budget,
      timeline: new Date(`${payload.timeline}T00:00:00.000Z`),
      urgency: payload.urgency,
      description: payload.description,
      source: WIX_ESTIMATE_SOURCE,
      externalRequestId: payload.externalRequestId,
      payloadHash: wixEstimatePayloadHash(payload),
      routing:
        payload.source === WIX_ESTIMATE_REQUEST_SOURCE.DIRECT
          ? {
              mode: "direct",
              contractorSource: WIX_ESTIMATE_SOURCE,
              contractorExternalId: payload.externalContractorId!,
            }
          : { mode: "general" },
    });

    return NextResponse.json(
      {
        ok: true,
        data: {
          leadId: result.leadId,
          replay: result.replay,
          reviewStatus: result.reviewStatus,
          blockers: result.blockers,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof LeadIntakeConflictError) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "idempotency_conflict",
            message: error.message,
          },
        },
        { status: 409 },
      );
    }
    if (error instanceof DomainError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "invalid_reference", message: error.message },
        },
        { status: 422 },
      );
    }

    console.error("[wix-estimate] request failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "internal_error",
          message: "The request could not be processed.",
        },
      },
      { status: 500 },
    );
  }
}
