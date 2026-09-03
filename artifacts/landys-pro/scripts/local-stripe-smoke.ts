/** Exercise a real Stripe test PaymentIntent and signed localhost webhook. */
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { assertLocalSupabaseIsolation } from "../lib/ops/database-safety";

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  if (process.env.LANDYS_ENV !== "local") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "local".');
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const directUrl = process.env.DIRECT_URL?.trim();
  const expectedProjectRef = process.env.LOCAL_SUPABASE_PROJECT_REF?.trim();
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!databaseUrl || !directUrl || !expectedProjectRef) {
    throw new Error("The isolated DEV database configuration is incomplete.");
  }
  if (!secretKey?.startsWith("sk_test_")) {
    throw new Error("Refusing: STRIPE_SECRET_KEY must be a Stripe test key.");
  }
  assertLocalSupabaseIsolation({
    databaseUrl,
    directUrl,
    expectedProjectRef,
    supabaseUrl: process.env.SUPABASE_URL,
  });

  const db = new PrismaClient();
  try {
    const fee = await db.successFee.findFirst({
      where: { status: "DUE" },
      orderBy: { createdAt: "asc" },
      include: { leadMatch: { select: { id: true, contractorId: true } } },
    });
    if (!fee) throw new Error("No Due success-fee fixture is available. Run pnpm dev:reseed.");

    const stripe = new Stripe(secretKey);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: fee.feeAmountCents,
      currency: "usd",
      payment_method: "pm_card_visa",
      payment_method_types: ["card"],
      confirm: true,
      metadata: {
        purpose: "success_fee",
        leadMatchId: fee.leadMatch.id,
        contractorId: fee.leadMatch.contractorId,
      },
    });

    for (let attempt = 0; attempt < 40; attempt += 1) {
      const updated = await db.successFee.findUnique({ where: { id: fee.id } });
      if (
        updated?.status === "PAID" &&
        updated.stripePaymentIntentId === paymentIntent.id
      ) {
        const walletTxCount = await db.walletTransaction.count({
          where: { stripePaymentIntentId: paymentIntent.id },
        });
        if (walletTxCount > 0) {
          throw new Error(
            `BUG: success-fee PI ${paymentIntent.id} created ${walletTxCount} WalletTransaction row(s).`,
          );
        }
        if (updated.paidAt == null || updated.paymentMethod !== "stripe") {
          throw new Error("Success fee PAID metadata incomplete after webhook.");
        }
        console.log(
          JSON.stringify({
            stripeMode: "test",
            paymentIntentStatus: paymentIntent.status,
            webhookResult: "PAID",
            successFeeId: fee.id,
            paidAt: updated.paidAt,
            paymentMethod: updated.paymentMethod,
            stripePaymentIntentId: updated.stripePaymentIntentId,
            walletTransactionsForPi: walletTxCount,
          }),
        );
        return;
      }
      await wait(1_500);
    }
    throw new Error("Stripe test payment succeeded, but the DEV fee did not become PAID in time.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
