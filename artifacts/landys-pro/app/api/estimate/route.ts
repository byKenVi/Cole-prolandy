import { NextResponse, type NextRequest } from "next/server";
import {
  createOfficialEstimateRequest,
} from "@/lib/services/lead-intake";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/domain/errors";
import { OfficialEstimateSchema } from "@/lib/integrations/estimate-fields";

/**
 * Public Landy's Pro estimate intake. Schema v2 persists an unresolved request
 * for explicit tier review. Requests without schemaVersion 2 are rejected.
 */
export async function POST(req: NextRequest) {
  const spamProtection =
    process.env.NODE_ENV === "production" || process.env.FORM_SPAM_PROTECTION !== "false";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const officialPayload =
    typeof body === "object" &&
    body !== null &&
    "schemaVersion" in body &&
    (body as { schemaVersion?: unknown }).schemaVersion === 2;

  if (!officialPayload) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "schema_version_required",
          message: 'Public estimate submissions require schemaVersion: 2.',
        },
      },
      { status: 422 },
    );
  }

  const parsed = OfficialEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid submission." },
      { status: 422 },
    );
  }
  const data = parsed.data;

  if (spamProtection) {
    if (data.company && data.company.trim() !== "") {
      return NextResponse.json({ ok: true });
    }
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const perHour = Number.parseInt(process.env.FORM_RATE_LIMIT_PER_HOUR ?? "10", 10);
    if (!rateLimit(`estimate:${ip}`, perHour, 3600 * 1000)) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429 },
      );
    }
  }

  try {
    const result = await createOfficialEstimateRequest({
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email,
      propertyZip: data.propertyZip,
      contractorCategoryCode: data.contractorCategoryCode,
      landTypeCode: data.landTypeCode,
      projectTypeCode: data.projectTypeCode,
      budget: data.budget,
      timeline: new Date(`${data.timeline}T00:00:00.000Z`),
      urgency: data.urgency,
      description: data.description,
      source: "landys_estimate",
      routing: { mode: "general" },
    });
    return NextResponse.json(
      {
        ok: true,
        leadId: result.leadId,
        reviewStatus: result.reviewStatus,
        blockers: result.blockers,
      },
      { status: 202 },
    );
  } catch (e) {
    if (e instanceof DomainError) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: "invalid_reference", message: e.message },
        },
        { status: 422 },
      );
    }

    console.error("[estimate] failed:", e);
    return NextResponse.json({ ok: false, error: "Could not submit your request." }, { status: 500 });
  }
}
