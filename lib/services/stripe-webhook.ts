import type Stripe from "stripe";
import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyWalletTransactionInTx } from "@/lib/domain/wallet";
import { getStripe } from "@/lib/integrations/payments";

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
};

export type CreditResult = { status: "credited" | "duplicate" | "ignored" };

/** Verify a raw webhook body against the signature header. Throws if invalid. */
export async function constructStripeEvent(
  rawBody: string,
  signature: string,
): Promise<Stripe.Event> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is required when STRIPE_MOCK=false.");
  const stripe = await getStripe();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/** Map a Stripe event to the fields we need to credit a top-up, or null to ignore. */
export function parseTopUpEvent(event: Stripe.Event): TopUpEvent | null {
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    return {
      eventId: event.id,
      eventType: event.type,
      contractorId: s.metadata?.contractorId ?? s.client_reference_id ?? "",
      amountCents: s.amount_total ?? 0,
      paymentIntentId:
        typeof s.payment_intent === "string"
          ? s.payment_intent
          : (s.payment_intent?.id ?? null),
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
    };
  }
  return null;
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

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
