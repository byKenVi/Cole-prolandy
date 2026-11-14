"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  createSuccessFeeCheckout,
  onlinePaymentsAvailable,
  payments,
  paymentsAreMocked,
} from "@/lib/integrations/payments";
import { notifyAdmins } from "@/lib/notifications";
import { markSuccessFeePaid } from "@/lib/domain/success-fee";
import { requireContractorId, requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { appUrl } from "@/lib/app-url";
import { confirmSuccessFeePayment } from "@/lib/services/stripe-webhook";
import { FollowUpAction } from "@prisma/client";
import { peekFollowUpToken } from "@/lib/domain/follow-up";

const PAYMENT_UNAVAILABLE =
  "Online payment is not available right now. Landy's has been notified and will contact you to collect the fee.";

async function alertPaymentProblem(leadMatchId: string, detail: string) {
  await notifyAdmins({
    kind: "payment_unavailable",
    title: "A contractor could not pay a success fee online",
    lines: [detail, "Contact the contractor and record the payment by hand, or fix the Stripe connection."],
    link: { label: "Open the fee", path: `/admin/fees/${leadMatchId}` },
  });
}

export type FeeActionResult =
  | { ok: true; checkoutUrl?: string; paid?: boolean }
  | { ok: false; message: string; fallbackToCheckout?: boolean };

export async function startSuccessFeePayment(leadMatchId: string): Promise<FeeActionResult> {
  const contractorId = await requireContractorId();
  const match = await prisma.leadMatch.findUnique({
    where: { id: leadMatchId },
    include: {
      successFee: true,
      contractor: { select: { id: true, name: true, email: true, stripeCustomerId: true } },
    },
  });
  if (!match || match.contractorId !== contractorId) {
    return { ok: false, message: "Fee not found." };
  }
  if (!match.successFee || match.successFee.status !== "DUE") {
    return { ok: false, message: "This success fee is not ready to pay yet." };
  }

  if (!onlinePaymentsAvailable()) {
    await alertPaymentProblem(leadMatchId, "Online payments are turned off (ONLINE_PAYMENTS_ENABLED=false).");
    return { ok: false, message: PAYMENT_UNAVAILABLE };
  }
  const base = appUrl();
  let checkout: Awaited<ReturnType<typeof createSuccessFeeCheckout>>;
  try {
    checkout = await createSuccessFeeCheckout({
      leadMatchId,
      contractorId,
      amountCents: match.successFee.feeAmountCents,
      stripeCustomerId: match.contractor.stripeCustomerId,
      contractorEmail: match.contractor.email,
      contractorName: match.contractor.name,
      successUrl: `${base}/fees?paid=${leadMatchId}`,
      cancelUrl: `${base}/fees/${leadMatchId}`,
    });
  } catch (error) {
    console.error("[fees] checkout creation failed", error);
    await alertPaymentProblem(leadMatchId, `Stripe checkout failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, message: PAYMENT_UNAVAILABLE };
  }
  const { checkoutUrl, customerId } = checkout;

  if (customerId && !match.contractor.stripeCustomerId) {
    await prisma.contractor.update({
      where: { id: contractorId },
      data: { stripeCustomerId: customerId },
    });
  }

  // Development only: createSuccessFeeCheckout refuses mock mode in production.
  if (paymentsAreMocked() && process.env.NODE_ENV !== "production") {
    await markSuccessFeePaid({
      leadMatchId,
      paymentMethod: "stripe",
      stripePaymentIntentId: `pi_mock_fee_${Date.now()}`,
    });
    await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        stripeDefaultPaymentMethodId: `pm_mock_${contractorId.slice(0, 8)}`,
        cardBrand: "visa",
        cardLast4: "4242",
      },
    });
    revalidatePath("/fees");
    redirect(`/fees?paid=${leadMatchId}`);
  }

  return { ok: true, checkoutUrl };
}

export async function paySuccessFeeWithSavedCard(leadMatchId: string): Promise<FeeActionResult> {
  const contractorId = await requireContractorId();
  const match = await prisma.leadMatch.findUnique({
    where: { id: leadMatchId },
    include: {
      successFee: true,
      contractor: {
        select: {
          id: true,
          stripeCustomerId: true,
          stripeDefaultPaymentMethodId: true,
        },
      },
    },
  });
  if (!match || match.contractorId !== contractorId) {
    return { ok: false, message: "Fee not found." };
  }
  if (!match.successFee || match.successFee.status !== "DUE") {
    return { ok: false, message: "This success fee is not ready to pay yet." };
  }
  const customerId = match.contractor.stripeCustomerId;
  const paymentMethodId = match.contractor.stripeDefaultPaymentMethodId;
  if (!customerId || !paymentMethodId) {
    return {
      ok: false,
      fallbackToCheckout: true,
      message: "No saved card on file. Continue with secure checkout.",
    };
  }

  const charge = await payments.chargeSavedCard({
    contractorId,
    amountCents: match.successFee.feeAmountCents,
    stripeCustomerId: customerId,
    paymentMethodId,
    metadata: {
      contractorId,
      leadMatchId,
      purpose: "success_fee",
      amountCents: String(match.successFee.feeAmountCents),
    },
    idempotencyKey: createHash("sha256")
      .update(["success-fee", leadMatchId, paymentMethodId].join("|"))
      .digest("hex"),
  });

  if (!charge.ok) {
    return {
      ok: false,
      fallbackToCheckout: true,
      message: charge.message,
    };
  }

  if (charge.mocked) {
    await confirmSuccessFeePayment({
      eventId: `evt_mock_fee_${charge.paymentIntentId}`,
      eventType: "payment_intent.succeeded",
      leadMatchId,
      contractorId,
      amountCents: match.successFee.feeAmountCents,
      paymentIntentId: charge.paymentIntentId,
      paymentMethodId: charge.paymentMethodId,
      stripeCustomerId: customerId,
    });
    revalidatePath("/fees");
    revalidatePath(`/fees/${leadMatchId}`);
    return { ok: true, paid: true };
  }

  revalidatePath("/fees");
  return { ok: true, paid: false };
}

export async function markFeePaidManually(
  leadMatchId: string,
  note?: string,
  extras?: {
    method?: "check" | "offline";
    paidAt?: string;
  },
): Promise<FeeActionResult> {
  const admin = await requireAdmin();
  try {
    const method = extras?.method === "check" ? "check" : extras?.method === "offline" ? "offline" : "manual";
    const paidAt = extras?.paidAt ? new Date(extras.paidAt) : undefined;
    await markSuccessFeePaid({
      leadMatchId,
      paymentMethod: method,
      paidByAdminId: admin.email,
      manualPaymentNote: note ?? null,
      paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : undefined,
    });
    revalidatePath("/admin/fees");
    revalidatePath("/admin/leads");
    revalidatePath(`/admin/fees/${leadMatchId}`);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof DomainError ? e.message : "Could not record the payment.",
    };
  }
}

/**
 * Login-free payment from the "your fee is due" text/email link. The token
 * only allows paying THIS fee, so it is safe to use without an account.
 */
export async function startFeePaymentByToken(token: string): Promise<FeeActionResult> {
  let row;
  try {
    row = await peekFollowUpToken(token, FollowUpAction.PAY_FEE);
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "This link is not valid." };
  }
  if (!row.leadMatchId) return { ok: false, message: "This link is not valid." };
  const match = await prisma.leadMatch.findUnique({
    where: { id: row.leadMatchId },
    include: {
      successFee: true,
      contractor: { select: { id: true, name: true, email: true, stripeCustomerId: true } },
    },
  });
  if (!match?.successFee) return { ok: false, message: "Fee not found." };
  if (match.successFee.status === "PAID") return { ok: true, paid: true };
  if (match.successFee.status !== "DUE") {
    return { ok: false, message: "This success fee is not ready to pay yet." };
  }

  if (!onlinePaymentsAvailable()) {
    await alertPaymentProblem(match.id, "Online payments are turned off (ONLINE_PAYMENTS_ENABLED=false).");
    return { ok: false, message: PAYMENT_UNAVAILABLE };
  }
  const base = appUrl();
  let checkout: Awaited<ReturnType<typeof createSuccessFeeCheckout>>;
  try {
    checkout = await createSuccessFeeCheckout({
      leadMatchId: match.id,
      contractorId: match.contractorId,
      amountCents: match.successFee.feeAmountCents,
      stripeCustomerId: match.contractor.stripeCustomerId,
      contractorEmail: match.contractor.email,
      contractorName: match.contractor.name,
      successUrl: `${base}/follow-up/${token}?paid=1`,
      cancelUrl: `${base}/follow-up/${token}`,
    });
  } catch (error) {
    console.error("[fees] token checkout creation failed", error);
    await alertPaymentProblem(match.id, `Stripe checkout failed: ${error instanceof Error ? error.message : String(error)}`);
    return { ok: false, message: PAYMENT_UNAVAILABLE };
  }
  if (checkout.customerId && !match.contractor.stripeCustomerId) {
    await prisma.contractor.update({
      where: { id: match.contractorId },
      data: { stripeCustomerId: checkout.customerId },
    });
  }
  if (checkout.mocked) {
    // Development only (production refuses mock payments above).
    await markSuccessFeePaid({
      leadMatchId: match.id,
      paymentMethod: "stripe",
      stripePaymentIntentId: checkout.paymentIntentId ?? `pi_mock_fee_${Date.now()}`,
    });
    revalidatePath(`/follow-up/${token}`);
    return { ok: true, paid: true };
  }
  return { ok: true, checkoutUrl: checkout.checkoutUrl };
}

