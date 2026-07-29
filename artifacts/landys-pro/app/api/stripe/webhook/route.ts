import { NextResponse, type NextRequest } from "next/server";
import {
  constructStripeEvent,
  parseTopUpEvent,
  creditTopUp,
  persistCardFromSetupSession,
} from "@/lib/services/stripe-webhook";
import { getStripeWebhookSecret } from "@/lib/integrations/stripe-client";

/**
 * Stripe webhook — the SOURCE OF TRUTH for real top-ups. The wallet is credited
 * ONLY here, after verifying the signature (never from the browser redirect).
 * This route stays OUTSIDE Clerk auth (see middleware public routes), exactly
 * like the tokenized SMS accept flow.
 *
 * In mock mode this endpoint is a no-op.
 *
 * Secret source: STRIPE_WEBHOOK_SECRET Replit Secret, which must match the signing
 * secret of the webhook endpoint registered on the Stripe connector account
 * (we_1TyZA1DZftuEtu8223cR6xoe → https://cole-prolandy-project.replit.app/api/stripe/webhook).
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.STRIPE_MOCK !== "false") {
    return NextResponse.json({ received: true, note: "Stripe in mock mode; webhook ignored." });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  // Raw body is required for signature verification — do not parse as JSON first.
  const rawBody = await req.text();

  let event: Awaited<ReturnType<typeof constructStripeEvent>>;
  try {
    event = await constructStripeEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    // Log masked secret info to aid debugging without leaking credentials.
    // Secret source: connector settings.webhook_secret (priority) or STRIPE_WEBHOOK_SECRET env var.
    let secretHint = "(unavailable)";
    try {
      const s = await getStripeWebhookSecret();
      const source = process.env.REPLIT_CONNECTORS_HOSTNAME
        ? "connector→env-fallback STRIPE_WEBHOOK_SECRET"
        : "env STRIPE_WEBHOOK_SECRET";
      secretHint = `${s.slice(0, 8)}… len=${s.length} source=${source}`;
    } catch {
      // Don't shadow the original error.
    }
    console.error(`[stripe-webhook] signature verification FAILED — ${message} | secret: ${secretHint}`);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    const setupResult = await persistCardFromSetupSession(event);
    if (setupResult.status !== "ignored") {
      console.log(
        `[stripe-webhook] card setup processed — event=${event.id} status=${setupResult.status}`,
      );
      return NextResponse.json({ received: true, status: setupResult.status, kind: "card_setup" });
    }

    const parsed = parseTopUpEvent(event);
    if (!parsed) {
      // Event type we don't act on — acknowledge so Stripe stops retrying.
      console.log(`[stripe-webhook] event ignored — type=${event.type} id=${event.id}`);
      return NextResponse.json({ received: true, ignored: event.type });
    }

    const result = await creditTopUp(parsed);
    console.log(
      `[stripe-webhook] top-up ${result.status} — event=${event.id} type=${event.type} contractor=${parsed.contractorId} amountCents=${parsed.amountCents}`,
    );
    return NextResponse.json({ received: true, status: result.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[stripe-webhook] processing error — event=${event.id} type=${event.type} error=${message}`,
    );
    // Return 500 so Stripe retries later.
    return NextResponse.json({ error: "Failed to process event." }, { status: 500 });
  }
}
