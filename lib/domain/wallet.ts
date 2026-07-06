import type { Prisma } from "@prisma/client";
import { WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { InsufficientBalanceError, NotFoundError } from "./errors";

export type ApplyWalletTransactionParams = {
  contractorId: string;
  /** Signed integer cents: positive credits, negative debits. */
  amountCents: number;
  type: WalletTransactionType;
  leadMatchId?: string | null;
  stripePaymentIntentId?: string | null;
  note?: string | null;
};

export type ApplyWalletTransactionResult = {
  transactionId: string;
  newBalanceCents: number;
};

/**
 * THE single mutation point for wallet balances (see DESIGN.md §4).
 * Must run INSIDE an interactive transaction. Uses an atomic, condition-guarded
 * UPDATE (Postgres row lock) so concurrent accepts cannot overspend or corrupt
 * the balance. Never allows a negative balance for debits.
 *
 * Never mutate walletBalanceCents anywhere else.
 */
export async function applyWalletTransactionInTx(
  tx: Prisma.TransactionClient,
  params: ApplyWalletTransactionParams,
): Promise<ApplyWalletTransactionResult> {
  const { contractorId, amountCents, type, leadMatchId, stripePaymentIntentId, note } =
    params;

  if (!Number.isInteger(amountCents)) {
    throw new Error("amountCents must be an integer (cents).");
  }

  if (amountCents < 0) {
    // Debit: atomically decrement only if funds are sufficient. The WHERE guard
    // + UPDATE takes a row lock, serializing concurrent debits on this row.
    const required = -amountCents;
    const res = await tx.contractor.updateMany({
      where: { id: contractorId, walletBalanceCents: { gte: required } },
      data: { walletBalanceCents: { increment: amountCents } },
    });
    if (res.count === 0) {
      const contractor = await tx.contractor.findUnique({
        where: { id: contractorId },
        select: { walletBalanceCents: true },
      });
      if (!contractor) throw new NotFoundError("Contractor");
      throw new InsufficientBalanceError(required - contractor.walletBalanceCents);
    }
  } else {
    // Credit.
    const res = await tx.contractor.updateMany({
      where: { id: contractorId },
      data: { walletBalanceCents: { increment: amountCents } },
    });
    if (res.count === 0) throw new NotFoundError("Contractor");
  }

  const transaction = await tx.walletTransaction.create({
    data: {
      contractorId,
      amountCents,
      type,
      leadMatchId: leadMatchId ?? null,
      stripePaymentIntentId: stripePaymentIntentId ?? null,
      note: note ?? null,
    },
    select: { id: true },
  });

  const contractor = await tx.contractor.findUnique({
    where: { id: contractorId },
    select: { walletBalanceCents: true },
  });

  return {
    transactionId: transaction.id,
    newBalanceCents: contractor?.walletBalanceCents ?? 0,
  };
}

/**
 * Convenience wrapper that opens its own transaction. Use for standalone wallet
 * changes (top-ups, admin adjustments). For operations that must be atomic with
 * other writes (e.g. accepting a lead), call `applyWalletTransactionInTx` inside
 * a shared transaction instead.
 */
export async function applyWalletTransaction(
  params: ApplyWalletTransactionParams,
): Promise<ApplyWalletTransactionResult> {
  return prisma.$transaction((tx) => applyWalletTransactionInTx(tx, params));
}
