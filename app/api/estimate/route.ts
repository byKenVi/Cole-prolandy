import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAndDistributeLead } from "@/lib/services/lead-intake";
import { rateLimit } from "@/lib/rate-limit";
import { DomainError } from "@/lib/domain/errors";
import { getDefaultLeadTier } from "@/lib/domain/settings";
import { prisma } from "@/lib/prisma";

/**
 * Public estimate intake — the Wix boundary. A Wix form/automation POSTs a
 * submission here; we validate, create a Lead (price snapshotted from the
 * matrix), distribute it, and fire notifications.
 *
 * Spam protection (honeypot + rate limit + format validation) is enabled by the
 * FORM_SPAM_PROTECTION flag. Field set is intentionally sensible and may change
 * after client review (tier is inferred server-side; landowners don't pick it).
 */
const EstimateSchema = z.object({
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

  const parsed = EstimateSchema.safeParse(body);
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
    const tier = await getDefaultLeadTier(prisma);
    const res = await createAndDistributeLead({
      landownerName: data.name,
      landownerEmail: data.email,
      landownerPhone: data.phone,
      propertyLocation: data.location,
      projectTypeId: data.projectTypeId,
      landTypeId: data.landTypeId || null,
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
