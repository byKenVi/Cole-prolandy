import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/integrations/payments";
import { creditTopUp, type CreditResult } from "@/lib/services/stripe-webhook";

/**
 * Post-checkout verification fallback.
 *
 * The webhook stays the primary crediting path, but it can be delayed or fail to
 * reach us (misconfigured endpoint, rotated signing secret, proxy swallowing the
 * POST). When that happens the contractor pays and the balance never moves —
 * so on return from Checkout we ask Stripe directly whether the session was
 * paid, and credit from that answer.
 *
 * This is not "trusting the browser": the only thing the browser supplies is a
 * session id, and every fact used to credit (amount, contractor, payment intent,
 * paid status) is read from Stripe's API. Crediting reuses the webhook's
 * transaction, so the two paths can never double-credit — whichever arrives
 * second hits the unique constraint on WalletTransaction.stripePaymentIntentId
 * and is recorded as a duplicate.
 */
export async function verifyAndCreditCheckoutSession(params: {
  sessionId: string;
  /** Contractor from the redirect URL — must match the session, or we refuse. */
  expectedContractorId: string;
}): Promise<CreditResult> {
  const { sessionId, expectedContractorId } = params;
  if (!sessionId.startsWith("cs_")) return { status: "ignored" };

  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  });

  // Setup-mode sessions save a card and must never credit money.
  if (session.mode !== "payment") return { status: "ignored" };
  if (session.payment_status !== "paid") return { status: "ignored" };

  const contractorId = session.metadata?.contractorId ?? session.client_reference_id ?? "";
  // Refuse to credit a wallet the redirect did not belong to.
  if (!contractorId || contractorId !== expectedContractorId) return { status: "ignored" };

  const amountCents = session.amount_total ?? 0;
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { status: "ignored" };

  const pi = session.payment_intent;
  const paymentIntentId = typeof pi === "string" ? pi : (pi?.id ?? null);
  const paymentMethodId =
    pi && typeof pi !== "string"
      ? typeof pi.payment_method === "string"
        ? pi.payment_method
        : (pi.payment_method?.id ?? null)
      : null;

  return creditTopUp({
    // Derived from the session id so replaying the success URL is a no-op.
    eventId: `checkout_session_verified:${session.id}`,
    eventType: "checkout.session.verified",
    contractorId,
    amountCents,
    paymentIntentId,
    paymentMethodId,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : (session.customer?.id ?? null),
  });
}

/**
 * Same fallback for the "save / replace card" flow: confirm the setup session
 * completed with Stripe, then persist the resulting payment method so the
 * contractor's card shows up immediately instead of waiting on a webhook that
 * may never arrive. Writing the same values twice is harmless.
 */
export async function verifyAndPersistSetupSession(params: {
  sessionId: string;
  expectedContractorId: string;
}): Promise<CreditResult> {
  const { sessionId, expectedContractorId } = params;
  if (!sessionId.startsWith("cs_")) return { status: "ignored" };

  const stripe = await getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["setup_intent"],
  });

  if (session.mode !== "setup") return { status: "ignored" };
  if (session.status !== "complete") return { status: "ignored" };

  const contractorId = session.metadata?.contractorId ?? session.client_reference_id ?? "";
  if (!contractorId || contractorId !== expectedContractorId) return { status: "ignored" };

  const si = session.setup_intent;
  const paymentMethodId =
    si && typeof si !== "string"
      ? typeof si.payment_method === "string"
        ? si.payment_method
        : (si.payment_method?.id ?? null)
      : null;
  if (!paymentMethodId) return { status: "ignored" };

  let cardBrand: string | null = null;
  let cardLast4: string | null = null;
  try {
    const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    cardBrand = pm.card?.brand ?? null;
    cardLast4 = pm.card?.last4 ?? null;
  } catch {
    // Non-fatal — the id alone is enough to charge the card later.
  }

  await prisma.contractor.updateMany({
    where: { id: contractorId },
    data: {
      stripeDefaultPaymentMethodId: paymentMethodId,
      cardBrand,
      cardLast4,
      ...(typeof session.customer === "string" ? { stripeCustomerId: session.customer } : {}),
    },
  });

  return { status: "credited" };
}
