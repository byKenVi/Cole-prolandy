import { NextResponse, type NextRequest } from "next/server";
import { applyWalletTransaction } from "@/lib/domain/wallet";
import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Stripe webhook — the SOURCE OF TRUTH for real top-ups. In real mode, credit
 * the wallet ONLY here after verifying the signature (never from the browser
 * redirect). In mock mode this endpoint is unused.
 *
 * TODO(real): verify signature and handle checkout.session.completed:
 *   const Stripe = (await import("stripe")).default;
 *   const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *   const sig = req.headers.get("stripe-signature")!;
 *   const event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET!);
 *   if (event.type === "checkout.session.completed") { ...credit wallet... }
 */
export async function POST(req: NextRequest) {
  if (process.env.STRIPE_MOCK !== "false") {
    return NextResponse.json({ ok: true, note: "Stripe is in mock mode; webhook ignored." });
  }

  // Placeholder body handling until signature verification is wired.
  let payload: { contractorId?: string; amountCents?: number; paymentIntentId?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
  }

  if (!payload.contractorId || !payload.amountCents) {
    return NextResponse.json({ ok: false, error: "Not implemented" }, { status: 501 });
  }

  await applyWalletTransaction({
    contractorId: payload.contractorId,
    amountCents: payload.amountCents,
    type: WalletTransactionType.TOPUP,
    stripePaymentIntentId: payload.paymentIntentId ?? null,
    note: "Wallet top-up (Stripe)",
  });
  await prisma.auditLog.create({
    data: {
      actorType: "system",
      action: "WALLET_TOPUP",
      targetType: "Contractor",
      targetId: payload.contractorId,
      metadata: { amountCents: payload.amountCents, source: "stripe" },
    },
  });
  return NextResponse.json({ ok: true });
}
