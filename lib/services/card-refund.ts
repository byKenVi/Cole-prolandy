/**
 * Real refund to card (admin) — send a contractor's money BACK to their card via
 * a Stripe refund against the original top-up PaymentIntent.
 *
 * This is DISTINCT from the internal `REFUND` type used by lead refunds:
 *   • REFUND       → CREDITS the wallet (money for a bad lead; no card movement).
 *   • CARD_REFUND  → DEBITS the wallet (real money physically left the wallet's
 *                    backing when it went back to the card).
 *
 * MONEY SAFETY:
 *   1) A card refund ALWAYS decreases the wallet by exactly the refunded amount
 *      (via applyWalletTransaction) and can NEVER drive the balance negative —
 *      the atomic guard in the wallet mutation is the hard backstop.
 *   2) The refund is capped at the lesser of: the original charge amount, the
 *      contractor's current REAL (card-backed, non-promo) balance, and — in real
 *      mode — Stripe's own refundable remainder (Stripe rejects over-refunds and
 *      we surface that gracefully without moving the wallet).
 *   3) Promo credit is NEVER refundable to a card.
 *   4) Each top-up can be card-refunded at most once (deterministic idempotency
 *      key on the CARD_REFUND wallet row + a matching Stripe idempotency key).
 *
 * We debit the wallet INLINE here (not via webhook) because we are the party
 * initiating the refund and must atomically guarantee balance safety. The
 * charge.refunded / refund.updated webhook events are therefore acknowledged and
 * ignored (see the webhook route) to avoid a double-debit.
 */
import { Prisma, WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { payments } from "@/lib/integrations/payments";
import { applyWalletTransactionInTx } from "@/lib/domain/wallet";

export type CardRefundResult =
  | { ok: true; refundedCents: number; newBalanceCents: number; message: string }
  | { ok: false; code: CardRefundErrorCode; message: string };

export type CardRefundErrorCode =
  | "not_found"
  | "no_real_balance"
  | "not_a_topup"
  | "already_refunded"
  | "not_refundable"
  | "error";

/** Deterministic idempotency key so a top-up can be card-refunded at most once. */
const refundKey = (paymentIntentId: string) => `cardrefund_${paymentIntentId}`;

/**
 * Compute the contractor's REAL (card-backed) balance = current wallet balance
 * minus outstanding promotional credit. Promo credit is never refundable, so we
 * conservatively treat it as the LAST money that could remain in the wallet.
 * Returns integer cents, floored at 0.
 */
async function realBalanceCents(
  client: Prisma.TransactionClient | typeof prisma,
  contractorId: string,
): Promise<{ balanceCents: number; realCents: number }> {
  const contractor = await client.contractor.findUnique({
    where: { id: contractorId },
    select: { walletBalanceCents: true },
  });
  const balanceCents = contractor?.walletBalanceCents ?? 0;
  const promo = await client.walletTransaction.findMany({
    where: { contractorId, type: WalletTransactionType.PROMO_CREDIT },
    select: { amountCents: true },
  });
  const promoOutstanding = promo.reduce((sum, t) => sum + Math.max(0, t.amountCents), 0);
  const realCents = Math.max(0, balanceCents - promoOutstanding);
  return { balanceCents, realCents };
}

/**
 * Refund a SPECIFIC past top-up to the card. Refunds the lesser of the top-up
 * amount and the contractor's current real balance (Stripe's remainder is the
 * final authority in real mode).
 */
export async function refundTopUpToCard(input: {
  contractorId: string;
  walletTransactionId: string;
  actorId?: string | null;
  reason?: string | null;
}): Promise<CardRefundResult> {
  const { contractorId, walletTransactionId } = input;

  const topup = await prisma.walletTransaction.findUnique({
    where: { id: walletTransactionId },
  });
  if (!topup || topup.contractorId !== contractorId) {
    return { ok: false, code: "not_found", message: "Top-up not found for this contractor." };
  }
  if (topup.type !== WalletTransactionType.TOPUP || !topup.stripePaymentIntentId) {
    return {
      ok: false,
      code: "not_a_topup",
      message: "Only real card top-ups can be refunded to a card.",
    };
  }

  // Idempotency first: a top-up already refunded to card is rejected regardless
  // of the current balance (a full refund leaves the real balance at zero).
  const alreadyRefunded = await prisma.walletTransaction.findFirst({
    where: { stripePaymentIntentId: refundKey(topup.stripePaymentIntentId) },
    select: { id: true },
  });
  if (alreadyRefunded) {
    return {
      ok: false,
      code: "already_refunded",
      message: "This top-up was already refunded to the card.",
    };
  }

  const { realCents } = await realBalanceCents(prisma, contractorId);
  if (realCents <= 0) {
    return {
      ok: false,
      code: "no_real_balance",
      message:
        "No real (card-backed) balance is available to refund. Promo credit can't be returned to a card.",
    };
  }

  const cap = Math.min(Math.abs(topup.amountCents), realCents);
  return executeRefund({
    contractorId,
    paymentIntentId: topup.stripePaymentIntentId,
    amountCents: cap,
    actorId: input.actorId ?? null,
    reason: input.reason ?? null,
    scope: "specific",
  });
}

/**
 * Return the contractor's REMAINING real balance to their card (the client's
 * "send their money back to Stripe" case). Refunds newest top-ups first until the
 * real balance is exhausted; promo credit is left untouched.
 */
export async function returnRealBalanceToCard(input: {
  contractorId: string;
  actorId?: string | null;
  reason?: string | null;
}): Promise<CardRefundResult> {
  const { contractorId } = input;
  const { realCents } = await realBalanceCents(prisma, contractorId);
  if (realCents <= 0) {
    return {
      ok: false,
      code: "no_real_balance",
      message:
        "No real (card-backed) balance is available to refund. Promo credit can't be returned to a card.",
    };
  }

  const topups = await prisma.walletTransaction.findMany({
    where: { contractorId, type: WalletTransactionType.TOPUP },
    orderBy: { createdAt: "desc" },
  });

  // Which top-ups were already card-refunded (deterministic key).
  const refunds = await prisma.walletTransaction.findMany({
    where: { contractorId, type: WalletTransactionType.CARD_REFUND },
    select: { stripePaymentIntentId: true },
  });
  const refundedKeys = new Set(refunds.map((r) => r.stripePaymentIntentId).filter(Boolean));

  let remaining = realCents;
  let totalRefunded = 0;
  let lastBalance: number | null = null;
  let lastError: CardRefundResult | null = null;

  for (const t of topups) {
    if (remaining <= 0) break;
    if (!t.stripePaymentIntentId) continue;
    if (refundedKeys.has(refundKey(t.stripePaymentIntentId))) continue;

    const cap = Math.min(Math.abs(t.amountCents), remaining);
    if (cap <= 0) continue;

    const res = await executeRefund({
      contractorId,
      paymentIntentId: t.stripePaymentIntentId,
      amountCents: cap,
      actorId: input.actorId ?? null,
      reason: input.reason ?? null,
      scope: "remaining",
    });

    if (res.ok) {
      totalRefunded += res.refundedCents;
      remaining -= res.refundedCents;
      lastBalance = res.newBalanceCents;
    } else if (res.code === "already_refunded") {
      continue; // skip and keep going
    } else {
      lastError = res; // stop on a real failure
      break;
    }
  }

  if (totalRefunded === 0) {
    return (
      lastError ?? {
        ok: false,
        code: "not_refundable",
        message: "No refundable card top-ups were found for the real balance.",
      }
    );
  }

  return {
    ok: true,
    refundedCents: totalRefunded,
    newBalanceCents: lastBalance ?? 0,
    message: `Refunded ${totalRefunded} cents to the card across ${topups.length} top-up(s).`,
  };
}

/**
 * Perform one refund: call Stripe (outside the DB transaction), then debit the
 * wallet atomically with a CARD_REFUND row. The debit can never go negative and
 * the deterministic key blocks a double refund of the same top-up.
 */
async function executeRefund(params: {
  contractorId: string;
  paymentIntentId: string;
  amountCents: number;
  actorId: string | null;
  reason: string | null;
  scope: "specific" | "remaining";
}): Promise<CardRefundResult> {
  const key = refundKey(params.paymentIntentId);

  // Pre-check: don't even call Stripe if we already card-refunded this top-up.
  const existing = await prisma.walletTransaction.findFirst({
    where: { stripePaymentIntentId: key },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, code: "already_refunded", message: "This top-up was already refunded to the card." };
  }

  const refund = await payments.refundToCard({
    paymentIntentId: params.paymentIntentId,
    amountCents: params.amountCents,
    idempotencyKey: key,
    metadata: { contractorId: params.contractorId, purpose: "card_refund" },
  });
  if (!refund.ok) {
    return { ok: false, code: refund.reason === "not_refundable" ? "not_refundable" : "error", message: refund.message };
  }

  const refundedCents = refund.refundedCents;
  try {
    const res = await prisma.$transaction(async (tx) => {
      // Debit the wallet by exactly the refunded amount. The atomic guard here is
      // the hard guarantee against a negative balance.
      const applied = await applyWalletTransactionInTx(tx, {
        contractorId: params.contractorId,
        amountCents: -Math.abs(refundedCents),
        type: WalletTransactionType.CARD_REFUND,
        // Deterministic key (prefixed) — unique, never collides with the TOPUP's
        // raw PI id, and blocks a second card-refund of the same top-up.
        stripePaymentIntentId: key,
        note: `Refunded to card (Stripe ${refund.refundId})${params.reason ? ` — ${params.reason}` : ""}`,
      });
      await tx.auditLog.create({
        data: {
          actorType: "admin",
          actorId: params.actorId,
          action: "WALLET_CARD_REFUND",
          targetType: "Contractor",
          targetId: params.contractorId,
          metadata: {
            refundedCents,
            paymentIntentId: params.paymentIntentId,
            refundId: refund.refundId,
            scope: params.scope,
            reason: params.reason,
            mocked: refund.mocked,
          },
        },
      });
      return applied;
    });
    return {
      ok: true,
      refundedCents,
      newBalanceCents: res.newBalanceCents,
      message: `Refunded ${refundedCents} cents to the card.`,
    };
  } catch (err) {
    // Unique violation → a concurrent request already recorded this refund.
    if (isUniqueViolation(err)) {
      return { ok: false, code: "already_refunded", message: "This top-up was already refunded to the card." };
    }
    // The Stripe refund succeeded but the wallet debit failed (e.g. the real
    // balance was spent concurrently). Surface it; the amounts are reconciled by
    // the deterministic key on retry.
    return {
      ok: false,
      code: "error",
      message: "The refund was issued but the wallet update failed. Please review this contractor's balance.",
    };
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
