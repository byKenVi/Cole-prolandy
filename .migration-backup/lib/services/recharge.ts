/**
 * Off-session recharge — charge a contractor's SAVED card without them being
 * present. Backs both the admin "Charge saved card & top up" action and the
 * contractor "1-click recharge". The money is the CONTRACTOR's (their saved
 * card), never the admin's.
 *
 * MONEY SAFETY — the wallet is credited by exactly ONE path:
 *   • REAL mode: the off-session PaymentIntent fires payment_intent.succeeded and
 *     the signature-verified webhook credits the wallet. We NEVER credit inline.
 *   • MOCK mode: there is no webhook, so we drive the SAME credit function the
 *     webhook uses (creditTopUp) to simulate it. Idempotency still applies
 *     (unique stripePaymentIntentId + ProcessedStripeEvent), so a duplicate is a
 *     no-op — dev behaves like production.
 *
 * Failures (no saved card / authentication_required / declined) return a clear,
 * UI-safe result with `fallbackToCheckout: true` so the caller can send the user
 * to the interactive Checkout. Raw Stripe errors are never surfaced.
 */
import { prisma } from "@/lib/prisma";
import { payments } from "@/lib/integrations/payments";
import { validateTopUpAmountCents } from "@/lib/domain/topup";
import { creditTopUp } from "@/lib/services/stripe-webhook";

export type RechargeActor = {
  type: "admin" | "contractor";
  /** Admin email or contractor id — recorded to the audit log. */
  id: string | null;
  /** Optional reason (admin-initiated charges log why). */
  reason?: string | null;
};

export type RechargeResult =
  | {
      ok: true;
      mocked: boolean;
      /** "credited" (mock, applied now) | "submitted" (real, webhook will credit) | "duplicate". */
      status: "credited" | "submitted" | "duplicate";
      newBalanceCents: number | null;
      message: string;
    }
  | {
      ok: false;
      code:
        | "no_saved_card"
        | "authentication_required"
        | "card_declined"
        | "invalid_amount"
        | "error";
      /** True when the UI should offer the normal secure Checkout instead. */
      fallbackToCheckout: boolean;
      message: string;
    };

export async function chargeContractorSavedCard(input: {
  contractorId: string;
  amountCents: number;
  actor: RechargeActor;
}): Promise<RechargeResult> {
  const { contractorId, amountCents, actor } = input;

  // Authoritative amount validation (same rules as interactive top-up).
  const check = validateTopUpAmountCents(amountCents);
  if (!check.ok) {
    return { ok: false, code: "invalid_amount", fallbackToCheckout: false, message: check.message };
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: {
      stripeCustomerId: true,
      stripeDefaultPaymentMethodId: true,
      walletBalanceCents: true,
    },
  });
  if (!contractor) {
    return { ok: false, code: "error", fallbackToCheckout: false, message: "Contractor not found." };
  }
  if (!contractor.stripeCustomerId || !contractor.stripeDefaultPaymentMethodId) {
    return {
      ok: false,
      code: "no_saved_card",
      fallbackToCheckout: true,
      message: "No saved card on file yet. Please top up via the secure checkout first.",
    };
  }

  // Same metadata shape the webhook already reads to credit the wallet.
  const metadata: Record<string, string> = {
    contractorId,
    amountCents: String(check.amountCents),
    purpose: "topup",
  };

  const charge = await payments.chargeSavedCard({
    contractorId,
    amountCents: check.amountCents,
    stripeCustomerId: contractor.stripeCustomerId,
    paymentMethodId: contractor.stripeDefaultPaymentMethodId,
    metadata,
  });

  if (!charge.ok) {
    await audit(actor, contractorId, "WALLET_RECHARGE_FAILED", {
      amountCents: check.amountCents,
      reason: charge.reason,
    });
    return { ok: false, code: charge.reason, fallbackToCheckout: true, message: charge.message };
  }

  let status: "credited" | "submitted" | "duplicate" = "submitted";
  let newBalanceCents: number | null = null;

  if (charge.mocked) {
    // No real webhook in mock mode — drive the SAME credit path the webhook uses.
    const credit = await creditTopUp({
      eventId: `evt_mock_recharge_${charge.paymentIntentId}`,
      eventType: "payment_intent.succeeded",
      contractorId,
      amountCents: check.amountCents,
      paymentIntentId: charge.paymentIntentId,
      paymentMethodId: charge.paymentMethodId,
      stripeCustomerId: contractor.stripeCustomerId,
    });
    status = credit.status === "duplicate" ? "duplicate" : "credited";
    const fresh = await prisma.contractor.findUnique({
      where: { id: contractorId },
      select: { walletBalanceCents: true },
    });
    newBalanceCents = fresh?.walletBalanceCents ?? null;
  }

  await audit(actor, contractorId, "WALLET_RECHARGE_OFF_SESSION", {
    amountCents: check.amountCents,
    paymentIntentId: charge.paymentIntentId,
    mocked: charge.mocked,
    reason: actor.reason ?? null,
  });

  return {
    ok: true,
    mocked: charge.mocked,
    status,
    newBalanceCents,
    message: charge.mocked
      ? "Saved card charged and wallet credited."
      : "Payment submitted — your balance updates as soon as the card payment confirms.",
  };
}

async function audit(
  actor: RechargeActor,
  contractorId: string,
  action: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: actor.type,
        actorId: actor.id,
        action,
        targetType: "Contractor",
        targetId: contractorId,
        metadata: metadata as never,
      },
    });
  } catch {
    // Audit failure must not break the money flow.
  }
}
