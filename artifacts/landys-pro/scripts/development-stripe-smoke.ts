/** Real Stripe TEST saved-card + success-fee smoke for native Development. */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { payments } from "../lib/integrations/payments";
import {
  getStripeSecretKey,
  getUncachableStripeClient,
} from "../lib/integrations/stripe-client";
import { ensureDevelopmentStripeManagedWebhook } from "../lib/integrations/stripe-managed-webhook";

async function waitFor<T>(
  description: string,
  read: () => Promise<T | null>,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

async function main() {
  if ((process.env.LANDYS_ENV ?? "development") !== "development") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "development".');
  }
  const db = new PrismaClient();
  try {
    const marker = await db.appSetting.findUnique({ where: { key: "environmentName" } });
    if (marker?.value !== "development") {
      throw new Error("Refusing: database is not marked Development.");
    }
    const fee = await db.successFee.findFirst({
      where: { status: "DUE", leadMatch: { contractorId: "dev_c1" } },
      orderBy: { createdAt: "asc" },
      include: { leadMatch: { include: { contractor: true } } },
    });
    if (!fee) throw new Error("No Due Development success-fee fixture found.");

    const stripe = await getUncachableStripeClient();
    const customer = await stripe.customers.create({
      email: fee.leadMatch.contractor.email,
      name: fee.leadMatch.contractor.name,
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
      metadata: { contractorId: fee.leadMatch.contractorId, environment: "development" },
    });
    const paymentMethodId =
      typeof customer.invoice_settings.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings.default_payment_method?.id;
    if (!paymentMethodId) throw new Error("Stripe did not create a saved test card.");

    await db.contractor.update({
      where: { id: fee.leadMatch.contractorId },
      data: { stripeCustomerId: customer.id, stripeDefaultPaymentMethodId: paymentMethodId },
    });

    const idempotencyKey = createHash("sha256")
      .update(["development-success-fee", fee.leadMatchId, paymentMethodId].join("|"))
      .digest("hex");
    const chargeInput = {
      contractorId: fee.leadMatch.contractorId,
      amountCents: fee.feeAmountCents,
      stripeCustomerId: customer.id,
      paymentMethodId,
      metadata: {
        purpose: "success_fee",
        leadMatchId: fee.leadMatchId,
        contractorId: fee.leadMatch.contractorId,
        amountCents: String(fee.feeAmountCents),
      },
      idempotencyKey,
    };
    const firstCharge = await payments.chargeSavedCard(chargeInput);
    const duplicateCharge = await payments.chargeSavedCard(chargeInput);
    if (!firstCharge.ok || !duplicateCharge.ok) {
      throw new Error("Stripe saved-card charge failed.");
    }
    if (firstCharge.paymentIntentId !== duplicateCharge.paymentIntentId) {
      throw new Error("Stripe idempotency key created more than one PaymentIntent.");
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(firstCharge.paymentIntentId);
    if (paymentIntent.livemode || paymentIntent.status !== "succeeded") {
      throw new Error("Stripe payment was not a successful test-mode PaymentIntent.");
    }

    const stripeEvent = await waitFor("Stripe payment_intent.succeeded event", async () => {
      const events = await stripe.events.list({ type: "payment_intent.succeeded", limit: 20 });
      return (
        events.data.find((event) => {
          const object = event.data.object;
          return "id" in object && object.id === paymentIntent.id;
        }) ?? null
      );
    });

    await waitFor("Development webhook persistence", async () => {
      const processed = await db.processedStripeEvent.findUnique({
        where: { id: stripeEvent.id },
      });
      return processed ? processed.id : null;
    });

    const managedWebhook = await ensureDevelopmentStripeManagedWebhook(
      await getStripeSecretKey(),
    );
    const replayPayload = JSON.stringify(stripeEvent);
    const replaySignature = stripe.webhooks.generateTestHeaderString({
      payload: replayPayload,
      secret: managedWebhook.webhookSecret,
    });
    const replayResponse = await fetch(managedWebhook.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": replaySignature,
      },
      body: replayPayload,
    });
    if (!replayResponse.ok) {
      throw new Error(`Idempotency replay failed with HTTP ${replayResponse.status}.`);
    }
    const replayResult = (await replayResponse.json()) as { status?: string };

    const [updatedFee, walletTransactions, processedEvents] = await Promise.all([
      db.successFee.findUnique({ where: { id: fee.id } }),
      db.walletTransaction.count(),
      db.processedStripeEvent.count({ where: { id: stripeEvent.id } }),
    ]);
    if (
      replayResult.status !== "duplicate" ||
      updatedFee?.status !== "PAID" ||
      walletTransactions !== 0 ||
      processedEvents !== 1
    ) {
      throw new Error("Success-fee persistence or idempotency verification failed.");
    }
    console.log(
      JSON.stringify({
        stripeMode: "test",
        savedCard: true,
        paymentIntentStatus: paymentIntent.status,
        idempotentPaymentIntent: true,
        developmentWebhookEventId: stripeEvent.id,
        idempotencyReplay: replayResult.status,
        feeStatus: updatedFee.status,
        walletTransactions,
      }),
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});