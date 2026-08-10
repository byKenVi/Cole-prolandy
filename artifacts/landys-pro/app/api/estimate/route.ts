import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  createAndDistributeLead,
  createOfficialEstimateRequest,
} from "@/lib/services/lead-intake";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/domain/errors";
import { getDefaultLeadTier } from "@/lib/domain/settings";
import { prisma } from "@/lib/prisma";

/**
 * Public Landy's Pro estimate intake. Schema v2 persists an unresolved request
 * for explicit tier review; schema v1 remains temporarily available for legacy
 * callers and keeps its historical default-tier behavior.
 */
const LegacyEstimateSchema = z.object({
  name: z.string().min(2, "Please enter your name"),
  phone: z.string().min(7, "Please enter a valid phone number"),
  email: z.string().email("Please enter a valid email"),
  location: z.string().min(2, "Please enter the property location"),
  projectTypeId: z.string().min(1, "Please choose a service"),
  landTypeId: z.string().optional().nullable(),
  description: z.string().max(2000).optional(),
  // Honeypot: must be empty. Bots tend to fill every field.
  company: z.string().optional(),
});

const OfficialEstimateSchema = z
  .object({
    schemaVersion: z.literal(2),
    firstName: z.string().trim().max(80).optional().nullable(),
    lastName: z.string().trim().max(80).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z.string().trim().email("Please enter a valid email"),
    propertyZip: z
      .string()
      .trim()
      .regex(/^\d{5}(?:-\d{4})?$/, "Please enter a valid property ZIP"),
    contractorCategoryCode: z.string().trim().min(1).max(80).optional().nullable(),
    landTypeCode: z.string().trim().min(1, "Please choose a land type").max(80),
    projectTypeCode: z.string().trim().min(1, "Please choose a project type").max(80),
    budget: z.string().trim().min(1, "Please enter a budget").max(280),
    timeline: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose a valid timeline date")
      .refine(
        (value) => !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime()),
        "Please choose a valid timeline date",
      ),
    urgency: z.string().trim().min(1, "Please enter the urgency").max(280),
    description: z.string().trim().min(10, "Please describe the project").max(4000),
    company: z.string().optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  // Spam protection is configurable in development via FORM_SPAM_PROTECTION, but
  // it is ALWAYS forced ON in production (honeypot + rate limit + validation) so
  // the public endpoint can't be left unprotected by a misconfigured flag.
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
  const parsed = officialPayload
    ? OfficialEstimateSchema.safeParse(body)
    : LegacyEstimateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid submission." },
      { status: 422 },
    );
  }
  const data = parsed.data;

  if (spamProtection) {
    // Honeypot
    if (data.company && data.company.trim() !== "") {
      // Silently accept to not tip off bots, but do nothing.
      return NextResponse.json({ ok: true });
    }
    // Rate limit per IP
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
    if (officialPayload) {
      const official = data as z.infer<typeof OfficialEstimateSchema>;
      const result = await createOfficialEstimateRequest({
        firstName: official.firstName,
        lastName: official.lastName,
        phone: official.phone,
        email: official.email,
        propertyZip: official.propertyZip,
        contractorCategoryCode: official.contractorCategoryCode,
        landTypeCode: official.landTypeCode,
        projectTypeCode: official.projectTypeCode,
        budget: official.budget,
        timeline: new Date(`${official.timeline}T00:00:00.000Z`),
        urgency: official.urgency,
        description: official.description,
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
    }

    const legacy = data as z.infer<typeof LegacyEstimateSchema>;
    console.info("[estimate.compatibility] accepted schemaVersion=1");
    const tier = await getDefaultLeadTier(prisma);
    const res = await createAndDistributeLead({
      landownerName: legacy.name,
      landownerEmail: legacy.email,
      landownerPhone: legacy.phone,
      propertyLocation: legacy.location,
      description: legacy.description?.trim() || null,
      projectTypeId: legacy.projectTypeId,
      landTypeId: legacy.landTypeId || null,
      tier,
      source: "wix_form",
    });
    return NextResponse.json({ ok: true, leadId: res.leadId, recipients: res.recipients });
  } catch (e) {
    if (e instanceof DomainError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }

    console.error("[estimate] failed:", e);
    return NextResponse.json({ ok: false, error: "Could not submit your request." }, { status: 500 });
  }
}
