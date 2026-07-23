import type Stripe from "stripe";
import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyWalletTransactionInTx } from "@/lib/domain/wallet";
import { getStripe } from "@/lib/integrations/payments";
import { getStripeWebhookSecret } from "@/lib/integrations/stripe-client";

/**
 * Stripe webhook handling for wallet top-ups. The webhook is the ONLY place the
 * wallet is credited in real mode. Two independent idempotency guards make a
 * duplicate delivery a no-op (Stripe retries and can send duplicates):
 *   1) ProcessedStripeEvent — unique on the Stripe event id, inserted in the
 *      SAME transaction as the credit. A retry of the exact event fails here.
 *   2) WalletTransaction.stripePaymentIntentId — unique. Two different event
 *      types for one payment (checkout.session.completed + payment_intent
 *      .succeeded share a PaymentIntent) can't both credit.
 * Either violation rolls the transaction back, so nothing is double-credited.
 */

export type TopUpEvent = {
  eventId: string;
  eventType: string;
  contractorId: string;
  amountCents: number;
  paymentIntentId: string | null;
  /** Saved card captured from the PI (setup_future_usage=off_session), if any. */
  paymentMethodId?: string | null;
  /** Stripe customer the payment belongs to, if present on the event. */
  stripeCustomerId?: string | null;
};

export type CreditResult = { status: "credited" | "duplicate" | "ignored" };

/** Verify a raw webhook body against the signature header. Throws if invalid. */
export async function constructStripeEvent(
  rawBody: string,
  signature: string,
): Promise<Stripe.Event> {
  // Webhook secret comes from the Replit Stripe connector (falls back to
  // STRIPE_WEBHOOK_SECRET env var for local dev without the connector).
  const secret = await getStripeWebhookSecret();
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Map a Stripe event to the fields we need to credit a top-up, or null to ignore. */
export function parseTopUpEvent(event: Stripe.Event): TopUpEvent | null {
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    // Setup-mode sessions only save a card — handled separately, never credit.
    if (s.mode === "setup") return null;
    return {
      eventId: event.id,
      eventType: event.type,
      contractorId: s.metadata?.contractorId ?? s.client_reference_id ?? "",
      amountCents: s.amount_total ?? 0,
      paymentIntentId:
        typeof s.payment_intent === "string"
          ? s.payment_intent
          : (s.payment_intent?.id ?? null),
      paymentMethodId: null,
      stripeCustomerId:
        typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null),
    };
  }
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    return {
      eventId: event.id,
      eventType: event.type,
      contractorId: pi.metadata?.contractorId ?? "",
      amountCents: pi.amount_received ?? pi.amount ?? 0,
      paymentIntentId: pi.id,
      paymentMethodId:
        typeof pi.payment_method === "string"
          ? pi.payment_method
          : (pi.payment_method?.id ?? null),
      stripeCustomerId: typeof pi.customer === "string" ? pi.customer : (pi.customer?.id ?? null),
    };
  }
  return null;
}

type CardFields = {
  stripeDefaultPaymentMethodId?: string;
  stripeCustomerId?: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

async function cardFieldsFromPaymentMethod(
  paymentMethodId: string | null | undefined,
  stripeCustomerId: string | null | undefined,
): Promise<CardFields> {
  const data: CardFields = {};
  if (stripeCustomerId) data.stripeCustomerId = stripeCustomerId;
  if (!paymentMethodId) return data;
  data.stripeDefaultPaymentMethodId = paymentMethodId;

  if (process.env.STRIPE_MOCK === "false") {
    try {
      const stripe = await getStripe();
      const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
      data.cardBrand = pm.card?.brand ?? null;
      data.cardLast4 = pm.card?.last4 ?? null;
    } catch {
      // Non-fatal — id is still saved.
    }
  } else if (paymentMethodId.startsWith("pm_mock")) {
    data.cardBrand = "visa";
    data.cardLast4 = "4242";
  }
  return data;
}

/**
 * Persist a card from a Checkout setup-mode session (change/replace card).
 * Idempotent via ProcessedStripeEvent.
 */
export async function persistCardFromSetupSession(event: Stripe.Event): Promise<CreditResult> {
  if (event.type !== "checkout.session.completed") return { status: "ignored" };
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.mode !== "setup") return { status: "ignored" };

  const contractorId = s.metadata?.contractorId ?? s.client_reference_id ?? "";
  if (!contractorId) return { status: "ignored" };

  const stripeCustomerId =
    typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null);

  let paymentMethodId: string | null = null;
  const setupIntentRef = s.setup_intent;
  if (setupIntentRef) {
    try {
      const stripe = await getStripe();
      const setupIntentId =
        typeof setupIntentRef === "string" ? setupIntentRef : setupIntentRef.id;
      const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
      paymentMethodId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent.payment_method?.id ?? null);
    } catch {
      return { status: "ignored" };
    }
  }

  if (!paymentMethodId && !stripeCustomerId) return { status: "ignored" };

  const cardData = await cardFieldsFromPaymentMethod(paymentMethodId, stripeCustomerId);

  try {
    await prisma.$transaction(async (tx) => {
      await tx.processedStripeEvent.create({ data: { id: event.id, type: event.type } });
      await tx.contractor.updateMany({
        where: { id: contractorId },
        data: cardData,
      });
      await tx.auditLog.create({
        data: {
          actorType: "contractor",
          actorId: contractorId,
          action: "CARD_UPDATED",
          targetType: "Contractor",
          targetId: contractorId,
          metadata: {
            eventId: event.id,
            paymentMethodId,
            cardBrand: cardData.cardBrand ?? null,
            cardLast4: cardData.cardLast4 ?? null,
          },
        },
      });
    });
    return { status: "credited" };
  } catch (err) {
    if (isUniqueViolation(err)) return { status: "duplicate" };
    throw err;
  }
}

/**
 * Credit a wallet from a parsed top-up event, exactly once. Records the event id
 * and applies the credit atomically; a duplicate (by event id OR payment intent)
 * is detected via a unique-constraint violation and skipped.
 */
export async function creditTopUp(e: TopUpEvent): Promise<CreditResult> {
  if (!e.contractorId || !Number.isInteger(e.amountCents) || e.amountCents <= 0) {
    return { status: "ignored" };
  }
  await persistSavedPaymentMethod(e);
  try {
    await prisma.$transaction(async (tx) => {
      await tx.processedStripeEvent.create({ data: { id: e.eventId, type: e.eventType } });
      await applyWalletTransactionInTx(tx, {
        contractorId: e.contractorId,
        amountCents: e.amountCents,
        type: WalletTransactionType.TOPUP,
        stripePaymentIntentId: e.paymentIntentId,
        note: "Wallet top-up (Stripe)",
      });
      await tx.auditLog.create({
        data: {
          actorType: "system",
          action: "WALLET_TOPUP",
          targetType: "Contractor",
          targetId: e.contractorId,
          metadata: {
            amountCents: e.amountCents,
            source: "stripe",
            eventId: e.eventId,
            eventType: e.eventType,
          },
        },
      });
    });
    return { status: "credited" };
  } catch (err) {
    if (isUniqueViolation(err)) return { status: "duplicate" };
    throw err;
  }
}

/**
 * Best-effort persistence of the saved payment method (and customer) captured
 * from a top-up event. Never throws — a failure here must not fail the credit.
 */
async function persistSavedPaymentMethod(e: TopUpEvent): Promise<void> {
  if (!e.paymentMethodId && !e.stripeCustomerId) return;
  try {
    const data = await cardFieldsFromPaymentMethod(e.paymentMethodId, e.stripeCustomerId);
    await prisma.contractor.updateMany({ where: { id: e.contractorId }, data });
  } catch {
    // Non-fatal: the card can be re-captured on the next top-up.
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
