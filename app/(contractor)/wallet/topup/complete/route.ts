import { NextResponse, type NextRequest } from "next/server";
import { applyWalletTransaction } from "@/lib/domain/wallet";
import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * MOCK top-up completion. In mock mode Stripe redirects the user here after a
 * simulated payment; we credit the wallet and record an audit entry.
 *
 * ⚠️ In REAL mode, DO NOT trust this redirect to add funds — money must be
 * credited from the verified Stripe webhook (/api/stripe/webhook) instead.
 * This handler only runs the credit when STRIPE_MOCK is on.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contractorId = url.searchParams.get("contractorId");
  const amountCents = Number.parseInt(url.searchParams.get("amountCents") ?? "", 10);
  const pi = url.searchParams.get("pi");
  const isMock = process.env.STRIPE_MOCK !== "false";

  const walletUrl = new URL("/wallet", url.origin);

  if (!isMock) {
    walletUrl.searchParams.set("topup", "pending");
    return NextResponse.redirect(walletUrl);
  }

  if (!contractorId || !pi || !Number.isFinite(amountCents) || amountCents <= 0) {
    walletUrl.searchParams.set("topup", "error");
    return NextResponse.redirect(walletUrl);
  }

  // Idempotency: the browser (and Next.js prefetch) can hit this GET several
  // times with the SAME payment-intent id, which previously credited the wallet
  // once per request. Credit at most once per pi. The unique index on
  // stripePaymentIntentId is the hard guarantee against concurrent duplicates.
  try {
    const existing = await prisma.walletTransaction.findFirst({
      where: { stripePaymentIntentId: pi },
      select: { id: true },
    });
    if (!existing) {
      await applyWalletTransaction({
        contractorId,
        amountCents,
        type: WalletTransactionType.TOPUP,
        stripePaymentIntentId: pi,
        note: "Wallet top-up (mock)",
      });
      await prisma.auditLog.create({
        data: {
          actorType: "contractor",
          actorId: contractorId,
          action: "WALLET_TOPUP",
          targetType: "Contractor",
          targetId: contractorId,
          metadata: { amountCents, mocked: true },
        },
      });
    }
  } catch (e) {
    // A concurrent request won the unique-index race for this pi → already
    // credited. Any other error is surfaced as an error state.
    const isDuplicate =
      typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
    if (!isDuplicate) {
      walletUrl.searchParams.set("topup", "error");
      return NextResponse.redirect(walletUrl);
    }
  }

  walletUrl.searchParams.set("topup", "success");
  return NextResponse.redirect(walletUrl);
}
