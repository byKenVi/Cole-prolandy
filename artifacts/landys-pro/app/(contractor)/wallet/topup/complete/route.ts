import { NextResponse, type NextRequest } from "next/server";
import { applyWalletTransaction } from "@/lib/domain/wallet";
import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateContractorShell } from "@/lib/revalidate";

/**
 * MOCK top-up / card-setup completion. In mock mode Stripe redirects here after
 * a simulated payment or card update.
 *
 * ⚠️ In REAL / production mode this never credits — money and cards come from
 * the verified Stripe webhook only.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contractorId = url.searchParams.get("contractorId");
  const amountCents = Number.parseInt(url.searchParams.get("amountCents") ?? "", 10);
  const pi = url.searchParams.get("pi");
  const pm = url.searchParams.get("pm");
  const isSetup = url.searchParams.get("setup") === "1";
  const isMock = process.env.STRIPE_MOCK !== "false";
  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  const walletUrl = new URL("/wallet", url.origin);

  // Fail closed: never mint money from a browser redirect in production.
  if (!isMock || isProd) {
    walletUrl.searchParams.set("topup", isSetup ? "card_pending" : "pending");
    return NextResponse.redirect(walletUrl);
  }

  if (!contractorId) {
    walletUrl.searchParams.set("topup", "error");
    return NextResponse.redirect(walletUrl);
  }

  if (isSetup) {
    const paymentMethodId = pm || `pm_mock_${Date.now().toString(36)}`;
    const existing = await prisma.contractor.findUnique({
      where: { id: contractorId },
      select: { stripeCustomerId: true },
    });
    await prisma.contractor.update({
      where: { id: contractorId },
      data: {
        stripeDefaultPaymentMethodId: paymentMethodId,
        stripeCustomerId: existing?.stripeCustomerId ?? `cus_mock_${contractorId.slice(0, 8)}`,
        cardBrand: "visa",
        cardLast4: "4242",
      },
    });
    await prisma.auditLog.create({
      data: {
        actorType: "contractor",
        actorId: contractorId,
        action: "CARD_UPDATED",
        targetType: "Contractor",
        targetId: contractorId,
        metadata: { paymentMethodId, mocked: true, cardBrand: "visa", cardLast4: "4242" },
      },
    });
    walletUrl.searchParams.set("topup", "card_saved");
    revalidateContractorShell();
    return NextResponse.redirect(walletUrl);
  }

  if (!pi || !Number.isFinite(amountCents) || amountCents <= 0) {
    walletUrl.searchParams.set("topup", "error");
    return NextResponse.redirect(walletUrl);
  }

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
    if (pm) {
      const row = await prisma.contractor.findUnique({
        where: { id: contractorId },
        select: { stripeCustomerId: true },
      });
      await prisma.contractor.update({
        where: { id: contractorId },
        data: {
          stripeDefaultPaymentMethodId: pm,
          stripeCustomerId: row?.stripeCustomerId ?? `cus_mock_${contractorId.slice(0, 8)}`,
          cardBrand: "visa",
          cardLast4: "4242",
        },
      });
    }
  } catch (e) {
    const isDuplicate =
      typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
    if (!isDuplicate) {
      walletUrl.searchParams.set("topup", "error");
      return NextResponse.redirect(walletUrl);
    }
  }

  walletUrl.searchParams.set("topup", "success");
  revalidateContractorShell();
  return NextResponse.redirect(walletUrl);
}
