import { NextResponse, type NextRequest } from "next/server";
import { applyWalletTransaction } from "@/lib/domain/wallet";
import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateContractorShell } from "@/lib/revalidate";

/**
 * Derive the public-facing origin from proxy headers.
 *
 * `req.url` / `url.origin` always contains the *internal* bind address
 * (e.g. http://0.0.0.0:21066) because Next.js sees the raw TCP socket, not
 * the proxied URL.  Replit (and Vercel) forward the real public host in
 * x-forwarded-host / x-forwarded-proto, so we use those instead.
 */
function publicOrigin(req: NextRequest): string {
  // x-forwarded-proto may be a comma-list; take the first (outermost) value.
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";

  // Reject internal / loopback addresses so we never redirect there.
  if (host && !host.includes("0.0.0.0") && !host.includes("127.0.0.1")) {
    return `${proto}://${host}`;
  }

  // Dev fallbacks: Replit dev domain → localhost.
  const replitDev = process.env.REPLIT_DEV_DOMAIN;
  if (replitDev) return `https://${replitDev}`;
  return "http://localhost:3000";
}

/**
 * MOCK top-up / card-setup completion. In mock mode Stripe redirects here after
 * a simulated payment or card update.
 *
 * ⚠️ In REAL / production mode this never credits — money and cards come from
 * the verified Stripe webhook only.
 */
/**
 * Validate a `returnTo` query param so we never redirect to an external URL.
 * Must start with "/" and not be a protocol-relative URL ("//...").
 */
function safeReturnPath(val: string | null): string | null {
  if (!val) return null;
  const decoded = decodeURIComponent(val);
  if (!decoded.startsWith("/") || decoded.startsWith("//")) return null;
  // Strip any existing topup param so we can set our own.
  try {
    const dummy = new URL(decoded, "https://x");
    dummy.searchParams.delete("topup");
    return dummy.pathname + (dummy.search ? dummy.search : "");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const contractorId = url.searchParams.get("contractorId");
  const amountCents = Number.parseInt(url.searchParams.get("amountCents") ?? "", 10);
  const pi = url.searchParams.get("pi");
  const pm = url.searchParams.get("pm");
  const isSetup = url.searchParams.get("setup") === "1";
  const returnPath = safeReturnPath(url.searchParams.get("returnTo"));
  const isMock = process.env.STRIPE_MOCK !== "false";
  const isProd =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";

  const origin = publicOrigin(req);
  const walletUrl = new URL("/wallet", origin);

  // Helper: build the final redirect target, preferring returnPath when present.
  function makeRedirect(status: "success" | "pending" | "card_saved" | "card_pending" | "error") {
    if (returnPath && status !== "error") {
      const dest = new URL(returnPath, origin);
      dest.searchParams.set("topup", status);
      return dest;
    }
    walletUrl.searchParams.set("topup", status);
    return walletUrl;
  }

  // Fail closed: never mint money from a browser redirect in production.
  if (!isMock || isProd) {
    return NextResponse.redirect(makeRedirect(isSetup ? "card_pending" : "pending"));
  }

  if (!contractorId) {
    return NextResponse.redirect(makeRedirect("error"));
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
    revalidateContractorShell();
    return NextResponse.redirect(makeRedirect("card_saved"));
  }

  if (!pi || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.redirect(makeRedirect("error"));
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
      return NextResponse.redirect(makeRedirect("error"));
    }
  }

  revalidateContractorShell();
  return NextResponse.redirect(makeRedirect("success"));
}
