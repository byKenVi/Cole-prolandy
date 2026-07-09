import { NextResponse, type NextRequest } from "next/server";
import { constructStripeEvent, parseTopUpEvent, creditTopUp } from "@/lib/services/stripe-webhook";

/**
 * Stripe webhook — the SOURCE OF TRUTH for real top-ups. The wallet is credited
 * ONLY here, after verifying the signature (never from the browser redirect).
 * This route stays OUTSIDE Clerk auth (see middleware public routes), exactly
 * like the tokenized SMS accept flow.
 *
 * In mock mode this endpoint is a no-op.
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

  let event;
  try {
    event = await constructStripeEvent(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json({ error: `Webhook signature verification failed: ${message}` }, {
      status: 400,
    });
  }

  const parsed = parseTopUpEvent(event);
  if (!parsed) {
    // Event type we don't act on — acknowledge so Stripe stops retrying. NOTE:
    // refund events (charge.refunded / refund.updated) are intentionally ignored
    // here: a card refund already DEBITS the wallet inline at the moment the
    // admin issues it (see lib/services/card-refund.ts), so reconciling again
    // from this webhook would double-debit.
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    const result = await creditTopUp(parsed);
    return NextResponse.json({ received: true, status: result.status });
  } catch {
    // Unexpected failure — return 500 so Stripe retries later.
    return NextResponse.json({ error: "Failed to process event." }, { status: 500 });
  }
}
