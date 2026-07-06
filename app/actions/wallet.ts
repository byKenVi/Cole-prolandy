"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { payments } from "@/lib/integrations/payments";
import { requireContractorId } from "@/lib/auth";

/**
 * Start a wallet top-up. In mock mode this returns a local URL that simulates a
 * completed payment; in real mode it returns a Stripe Checkout URL. Either way
 * the call site just redirects the user there.
 */
export async function startTopUp(amountCents: number) {
  const contractorId = await requireContractorId();
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Invalid top-up amount.");
  }

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { stripeCustomerId: true },
  });

  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const { checkoutUrl } = await payments.createTopUpCheckout({
    contractorId,
    amountCents,
    stripeCustomerId: contractor?.stripeCustomerId ?? null,
    successUrl: `${base}/wallet/topup/complete?contractorId=${contractorId}`,
    cancelUrl: `${base}/wallet`,
    metadata: { contractorId },
  });

  redirect(checkoutUrl);
}
