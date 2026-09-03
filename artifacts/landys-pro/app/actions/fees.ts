"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSuccessFeeCheckout, payments } from "@/lib/integrations/payments";
import { markSuccessFeePaid } from "@/lib/domain/success-fee";
import { requireContractorId, requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { appUrl } from "@/lib/app-url";
import { confirmSuccessFeePayment } from "@/lib/services/stripe-webhook";

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

  const base = appUrl();
  const { checkoutUrl, customerId } = await createSuccessFeeCheckout({
    leadMatchId,
    contractorId,
    amountCents: match.successFee.feeAmountCents,
    stripeCustomerId: match.contractor.stripeCustomerId,
    contractorEmail: match.contractor.email,
    contractorName: match.contractor.name,
    successUrl: `${base}/fees?paid=${leadMatchId}`,
    cancelUrl: `${base}/fees/${leadMatchId}`,
  });

  if (customerId && !match.contractor.stripeCustomerId) {
    await prisma.contractor.update({
      where: { id: contractorId },
      data: { stripeCustomerId: customerId },
    });
  }

  if (process.env.STRIPE_MOCK !== "false") {
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
