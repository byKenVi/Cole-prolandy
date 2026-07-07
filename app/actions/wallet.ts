"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { payments } from "@/lib/integrations/payments";
import { requireContractorId } from "@/lib/auth";
import { validateTopUpAmountCents } from "@/lib/domain/topup";

/**
 * Start a wallet top-up. In mock mode this returns a local URL that simulates a
 * completed payment; in real mode it returns a Stripe Checkout URL. Either way
 * the call site just redirects the user there.
 *
 * The amount is validated SERVER-SIDE here (authoritative) — never trust the
 * client. The wallet is credited later, only by the webhook (real mode) or the
 * idempotent mock-complete route (mock mode), never on this call.
 */
export async function startTopUp(amountCents: number) {
  const contractorId = await requireContractorId();
  const check = validateTopUpAmountCents(amountCents);
  if (!check.ok) throw new Error(check.message);

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const { checkoutUrl, customerId } = await payments.createTopUpCheckout({
    contractorId,
    amountCents: check.amountCents,
    stripeCustomerId: contractor?.stripeCustomerId ?? null,
    contractorEmail: contractor?.email ?? null,
    contractorName: contractor?.name ?? null,
    successUrl: `${base}/wallet/topup/complete?contractorId=${contractorId}`,
    cancelUrl: `${base}/wallet`,
    metadata: { contractorId },
  });

  // Persist a newly-created Stripe customer id so future top-ups reuse it.
  if (customerId && customerId !== contractor?.stripeCustomerId) {
    await prisma.contractor.update({
      where: { id: contractorId },
      data: { stripeCustomerId: customerId },
    });
  }

  redirect(checkoutUrl);
}
