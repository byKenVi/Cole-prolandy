import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  constructStripeEvent,
  parseTopUpEvent,
  creditTopUp,
  persistCardFromSetupSession,
  parseSuccessFeeEvent,
  confirmSuccessFeePayment,
} from "@/lib/services/stripe-webhook";
import { getStripeWebhookSecret } from "@/lib/integrations/stripe-client";

/**
 * Stripe webhook — the primary path for real top-ups, crediting only after the
 * signature verifies. It is no longer the only one: the post-checkout return
 * also credits, by asking Stripe's API about the session (lib/services/
 * topup-verify.ts), because a webhook that never arrives left contractors paid
 * and un-credited. Both go through creditTopUp and dedupe on the payment
 * intent, so whichever lands second is recorded as a duplicate.
 * Neither path ever trusts a figure supplied by the browser.
 * This route stays OUTSIDE Clerk auth (see middleware public routes), exactly
 * like the tokenized SMS accept flow.
 *
 * In mock mode this endpoint is a no-op.
 *
 * Development uses the Replit Stripe sandbox's managed Preview webhook secret.
 * Production retains its connector/environment fallback and is not modified by
 * Development setup.
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
    // Identify WHICH secret was used without putting any of it in the logs: a
    // truncated digest is enough to compare against the endpoint's expected
    // secret, and cannot be reversed the way a literal prefix could.
    // Source: connector settings.webhook_secret (priority) or STRIPE_WEBHOOK_SECRET.
    let secretHint = "(unavailable)";
    try {
      const s = await getStripeWebhookSecret();
       const source = process.env.REPLIT_CONNECTORS_HOSTNAME
         ? "Replit connector/managed webhook"
         : "env STRIPE_WEBHOOK_SECRET";
      const digest = createHash("sha256").update(s).digest("hex").slice(0, 8);
      secretHint = `sha256:${digest} len=${s.length} source=${source}`;
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

    // Success-fee PaymentIntents also carry contractorId and amount metadata,
    // so dispatch them before the legacy top-up parser.
    const feeParsed = parseSuccessFeeEvent(event);
    if (feeParsed) {
      const result = await confirmSuccessFeePayment(feeParsed);
      console.log(
        `[stripe-webhook] success-fee ${result.status} — event=${event.id} leadMatch=${feeParsed.leadMatchId}`,
      );
      return NextResponse.json({ received: true, status: result.status, kind: "success_fee" });
    }

    const parsed = parseTopUpEvent(event);
    if (parsed) {
      const result = await creditTopUp(parsed);
      console.log(
        `[stripe-webhook] top-up ${result.status} — event=${event.id} type=${event.type} contractor=${parsed.contractorId} amountCents=${parsed.amountCents}`,
      );
      return NextResponse.json({ received: true, status: result.status });
    }

    // Event type we don't act on — acknowledge so Stripe stops retrying.
    console.log(`[stripe-webhook] event ignored — type=${event.type} id=${event.id}`);
    return NextResponse.json({ received: true, ignored: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[stripe-webhook] processing error — event=${event.id} type=${event.type} error=${message}`,
    );
    // Return 500 so Stripe retries later.
    return NextResponse.json({ error: "Failed to process event." }, { status: 500 });
  }
}
