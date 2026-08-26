import type { SuccessFeeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "./types";
import { InvalidStateError, NotFoundError } from "./errors";

export type SuccessFeeTierRow = {
  sortOrder: number;
  maxValueCents: number | null;
  rateBasisPoints: number;
};

export type ResolvedSuccessFee = {
  rateBasisPoints: number;
  feeAmountCents: number;
};

/** Resolve applicable tier for a final job value (integer cents). */
export function resolveSuccessFeeForValue(
  tiers: SuccessFeeTierRow[],
  finalValueCents: number,
): ResolvedSuccessFee {
  if (!Number.isInteger(finalValueCents) || finalValueCents <= 0) {
    throw new InvalidStateError("Final job value must be a positive whole number of cents.");
  }
  const sorted = [...tiers].sort((a, b) => a.sortOrder - b.sortOrder);
  if (sorted.length === 0) {
    throw new InvalidStateError("Success fee tiers are not configured.");
  }
  let rate = sorted[sorted.length - 1].rateBasisPoints;
  for (const tier of sorted) {
    if (tier.maxValueCents === null || finalValueCents <= tier.maxValueCents) {
      rate = tier.rateBasisPoints;
      break;
    }
  }
  const feeAmountCents = Math.round((finalValueCents * rate) / 10_000);
  return { rateBasisPoints: rate, feeAmountCents: Math.max(1, feeAmountCents) };
}

export async function loadSuccessFeeTiers(db: DbClient): Promise<SuccessFeeTierRow[]> {
  const rows = await db.successFeeTier.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map((r) => ({
    sortOrder: r.sortOrder,
    maxValueCents: r.maxValueCents,
    rateBasisPoints: r.rateBasisPoints,
  }));
}

/** Preview fee rate for an estimated value (opportunity cards). */
export async function previewSuccessFeeRate(
  db: DbClient,
  estimatedValueCents: number,
): Promise<{ rateBasisPoints: number; ratePercent: number }> {
  const tiers = await loadSuccessFeeTiers(db);
  const { rateBasisPoints } = resolveSuccessFeeForValue(tiers, estimatedValueCents);
  return { rateBasisPoints, ratePercent: rateBasisPoints / 100 };
}

export type CreateSuccessFeeSnapshotParams = {
  leadMatchId: string;
  finalValueCents: number;
};

/**
 * Create an immutable success-fee snapshot when contractor reports Won.
 * Status starts AWAITING_CONTRACTOR_PAYMENT — not DUE until contractor confirms paid.
 */
export async function createSuccessFeeSnapshot(
  db: DbClient,
  params: CreateSuccessFeeSnapshotParams,
) {
  const existing = await db.successFee.findUnique({
    where: { leadMatchId: params.leadMatchId },
  });
  if (existing) {
    throw new InvalidStateError("A success fee already exists for this job.");
  }

  const tiers = await loadSuccessFeeTiers(db);
  const { rateBasisPoints, feeAmountCents } = resolveSuccessFeeForValue(
    tiers,
    params.finalValueCents,
  );

  return db.successFee.create({
    data: {
      leadMatchId: params.leadMatchId,
      finalValueCents: params.finalValueCents,
      rateBasisPoints,
      feeAmountCents,
      status: "AWAITING_CONTRACTOR_PAYMENT",
    },
  });
}

/** Mark fee DUE when contractor confirms they have been paid by the landowner. */
export async function markSuccessFeeDue(db: DbClient, leadMatchId: string) {
  const fee = await db.successFee.findUnique({ where: { leadMatchId } });
  if (!fee) throw new NotFoundError("Success fee");
  if (fee.status === "PAID") {
    throw new InvalidStateError("This success fee has already been paid.");
  }
  if (fee.status === "DUE") {
    return fee;
  }
  if (fee.status !== "AWAITING_CONTRACTOR_PAYMENT") {
    throw new InvalidStateError("This success fee cannot be marked due.");
  }
  return db.successFee.update({
    where: { id: fee.id },
    data: { status: "DUE" as SuccessFeeStatus, dueAt: new Date() },
  });
}

export async function markSuccessFeePaid(params: {
  leadMatchId: string;
  paymentMethod: "stripe" | "manual";
  stripePaymentIntentId?: string | null;
  paidByAdminId?: string | null;
  manualPaymentNote?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const fee = await tx.successFee.findUnique({ where: { leadMatchId: params.leadMatchId } });
    if (!fee) throw new NotFoundError("Success fee");
    if (fee.status === "PAID") return fee;
    if (fee.status !== "DUE") {
      throw new InvalidStateError("Success fee must be due before it can be paid.");
    }

    const updated = await tx.successFee.update({
      where: { id: fee.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: params.paymentMethod,
        stripePaymentIntentId: params.stripePaymentIntentId ?? fee.stripePaymentIntentId,
        paidByAdminId: params.paidByAdminId ?? null,
        manualPaymentNote: params.manualPaymentNote ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: params.paymentMethod === "manual" ? "admin" : "system",
        actorId: params.paidByAdminId ?? null,
        action: "SUCCESS_FEE_PAID",
        targetType: "SuccessFee",
        targetId: fee.id,
        metadata: {
          leadMatchId: params.leadMatchId,
          paymentMethod: params.paymentMethod,
          feeAmountCents: fee.feeAmountCents,
          manualPaymentNote: params.manualPaymentNote ?? null,
        },
      },
    });

    return updated;
  });
}

export type SuccessFeeTierRecord = {
  id: string;
  sortOrder: number;
  maxValueCents: number | null;
  rateBasisPoints: number;
};

export async function loadSuccessFeeTierRecords(db: DbClient): Promise<SuccessFeeTierRecord[]> {
  return db.successFeeTier.findMany({ orderBy: { sortOrder: "asc" } });
}

export async function updateSuccessFeeTier(
  db: DbClient,
  params: {
    id: string;
    maxValueCents?: number | null;
    rateBasisPoints: number;
  },
) {
  if (!Number.isInteger(params.rateBasisPoints) || params.rateBasisPoints < 1 || params.rateBasisPoints > 10_000) {
    throw new InvalidStateError("Rate must be between 0.01% and 100%.");
  }
  const tier = await db.successFeeTier.findUnique({ where: { id: params.id } });
  if (!tier) throw new NotFoundError("Success fee tier");

  if (params.maxValueCents !== undefined && tier.sortOrder < 3) {
    if (params.maxValueCents === null || !Number.isInteger(params.maxValueCents) || params.maxValueCents < 1) {
      throw new InvalidStateError("Threshold must be a positive whole number of cents.");
    }
  }

  return db.successFeeTier.update({
    where: { id: params.id },
    data: {
      rateBasisPoints: params.rateBasisPoints,
      ...(params.maxValueCents !== undefined ? { maxValueCents: params.maxValueCents } : {}),
    },
  });
}
