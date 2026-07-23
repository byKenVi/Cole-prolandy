"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { payments } from "@/lib/integrations/payments";
import { requireContractorId } from "@/lib/auth";
import { validateTopUpAmountCents } from "@/lib/domain/topup";
import { chargeContractorSavedCard, type RechargeResult } from "@/lib/services/recharge";
import { revalidateContractorShell } from "@/lib/revalidate";
import { appUrl } from "@/lib/app-url";

/**
 * Resolve the base URL for Stripe redirect URLs.
 * Priority: client-supplied origin (window.location.origin from the browser)
 * → NEXT_PUBLIC_APP_URL env var → REPLIT_DEV_DOMAIN → localhost fallback.
 *
 * The client origin is the most reliable source because the browser is
 * the one that needs to receive the redirect — it always knows its own URL.
 */
function resolveBaseUrl(clientOrigin: string | null | undefined): string {
  // Validate and use the client-supplied origin if it looks like a real URL
  // (not the container's internal bind address).
  if (
    clientOrigin &&
    !clientOrigin.includes("0.0.0.0") &&
    !clientOrigin.includes("127.0.0.1") &&
    clientOrigin.startsWith("http")
  ) {
    return clientOrigin.replace(/\/+$/, "");
  }
  return appUrl();
}

/**
 * Start a wallet top-up. In mock mode this returns a local URL that simulates a
 * completed payment; in real mode it returns a Stripe Checkout URL. Either way
 * the call site just redirects the user there.
 *
 * The amount is validated SERVER-SIDE here (authoritative) — never trust the
 * client. The wallet is credited later, only by the webhook (real mode) or the
 * idempotent mock-complete route (mock mode), never on this call.
 */
export async function startTopUp(amountCents: number, clientOrigin?: string) {
  const contractorId = await requireContractorId();
  const check = validateTopUpAmountCents(amountCents);
  if (!check.ok) throw new Error(check.message);

  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  const base = resolveBaseUrl(clientOrigin);
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

/**
 * Contractor "1-click recharge" using the saved card (off-session). Validated
 * server-side; the wallet is credited only by the webhook (real) or the shared
 * mock credit path (mock). Returns a UI-safe result; when there is no saved card
 * or the charge needs the cardholder present, `fallbackToCheckout` is true and
 * the client should use the interactive `startTopUp` flow instead.
 */
export async function rechargeSavedCard(amountCents: number): Promise<RechargeResult> {
  const contractorId = await requireContractorId();
  const res = await chargeContractorSavedCard({
    contractorId,
    amountCents,
    actor: { type: "contractor", id: contractorId },
  });
  if (res.ok) revalidateContractorShell();
  return res;
}

/**
 * Start a Stripe Checkout (setup mode) so the contractor can save or replace
 * their default card without charging. Redirects to Stripe.
 */
export async function startCardUpdate(clientOrigin?: string) {
  const contractorId = await requireContractorId();
  const contractor = await prisma.contractor.findUnique({
    where: { id: contractorId },
    select: { stripeCustomerId: true, email: true, name: true },
  });

  const base = resolveBaseUrl(clientOrigin);
  const { checkoutUrl, customerId } = await payments.createCardSetupCheckout({
    contractorId,
    stripeCustomerId: contractor?.stripeCustomerId ?? null,
    contractorEmail: contractor?.email ?? null,
    contractorName: contractor?.name ?? null,
    successUrl: `${base}/wallet/topup/complete?contractorId=${contractorId}&setup=1`,
    cancelUrl: `${base}/wallet`,
  });

  if (customerId && customerId !== contractor?.stripeCustomerId) {
    await prisma.contractor.update({
      where: { id: contractorId },
      data: { stripeCustomerId: customerId },
    });
  }

  redirect(checkoutUrl);
}
