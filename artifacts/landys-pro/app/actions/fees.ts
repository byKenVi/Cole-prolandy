"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createSuccessFeeCheckout } from "@/lib/integrations/payments";
import { markSuccessFeePaid } from "@/lib/domain/success-fee";
import { requireContractorId, requireAdmin } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import { appUrl } from "@/lib/app-url";

export type FeeActionResult =
  | { ok: true; checkoutUrl?: string }
  | { ok: false; message: string };

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
    cancelUrl: `${base}/fees`,
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
    revalidatePath("/fees");
    redirect(`/fees?paid=${leadMatchId}`);
  }

  return { ok: true, checkoutUrl };
}

export async function markFeePaidManually(
  leadMatchId: string,
  note?: string,
): Promise<FeeActionResult> {
  const admin = await requireAdmin();
  try {
    await markSuccessFeePaid({
      leadMatchId,
      paymentMethod: "manual",
      paidByAdminId: admin.email,
      manualPaymentNote: note ?? null,
    });
    revalidatePath("/admin/fees");
    revalidatePath("/admin/leads");
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof DomainError ? e.message : "Could not mark fee as paid.",
    };
  }
}
