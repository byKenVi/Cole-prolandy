import { FollowUpAction, JobOutcome, LeadMatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSuccessFeeSnapshot, markSuccessFeeDue } from "./success-fee";
import {
  getFollowUpOutcomeDelayHours,
  getFollowUpPaymentDelayHours,
  getFollowUpPaymentRetryHours,
} from "./settings";
import { InvalidStateError, NotFoundError } from "./errors";
import {
  createFollowUpToken,
  FOLLOW_UP_STAGES,
  scheduleOutcomeFollowUp,
  schedulePaymentFollowUp,
} from "./follow-up";

export async function reportJobWon(params: {
  leadMatchId: string;
  finalContractValueCents: number;
  actorType?: string;
  actorId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.leadMatch.findUnique({
      where: { id: params.leadMatchId },
      include: { successFee: true },
    });
    if (!match) throw new NotFoundError("Lead invite");
    if (match.status !== LeadMatchStatus.ACCEPTED) {
      throw new InvalidStateError("Only accepted opportunities can be marked won.");
    }
    if (match.jobOutcome === JobOutcome.LOST) {
      throw new InvalidStateError("This job was already marked lost.");
    }
    if (match.jobOutcome === JobOutcome.WON && match.successFee) {
      return { match, fee: match.successFee, alreadyWon: true as const };
    }

    const now = new Date();
    const updated = await tx.leadMatch.update({
      where: { id: match.id },
      data: {
        jobOutcome: JobOutcome.WON,
        finalContractValueCents: params.finalContractValueCents,
        outcomeReportedAt: now,
        followUpStage: FOLLOW_UP_STAGES.payment,
        followUpAttempts: 0,
      },
    });

    const fee = await createSuccessFeeSnapshot(tx, {
      leadMatchId: match.id,
      finalValueCents: params.finalContractValueCents,
    });

    const paymentDelayHours = await getFollowUpPaymentDelayHours(tx);
    const followUpNextAt = new Date(now.getTime() + paymentDelayHours * 3600 * 1000);
    await tx.leadMatch.update({
      where: { id: match.id },
      data: { followUpNextAt },
    });

    await tx.auditLog.create({
      data: {
        actorType: params.actorType ?? "contractor",
        actorId: params.actorId ?? match.contractorId,
        action: "JOB_WON",
        targetType: "LeadMatch",
        targetId: match.id,
        metadata: {
          finalContractValueCents: params.finalContractValueCents,
          feeAmountCents: fee.feeAmountCents,
          rateBasisPoints: fee.rateBasisPoints,
        },
      },
    });

    return { match: updated, fee, alreadyWon: false as const };
  });
}

export async function reportJobLost(params: {
  leadMatchId: string;
  actorType?: string;
  actorId?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    const match = await tx.leadMatch.findUnique({ where: { id: params.leadMatchId } });
    if (!match) throw new NotFoundError("Lead invite");
    if (match.status !== LeadMatchStatus.ACCEPTED) {
      throw new InvalidStateError("Only accepted opportunities can be marked lost.");
    }
    if (match.jobOutcome === JobOutcome.WON) {
      throw new InvalidStateError("This job was already marked won.");
    }
    if (match.jobOutcome === JobOutcome.LOST) {
      return { match, alreadyLost: true as const };
    }

    const updated = await tx.leadMatch.update({
      where: { id: match.id },
      data: {
        jobOutcome: JobOutcome.LOST,
        outcomeReportedAt: new Date(),
        followUpStage: null,
        followUpNextAt: null,
        followUpAttempts: 0,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: params.actorType ?? "contractor",
        actorId: params.actorId ?? match.contractorId,
        action: "JOB_LOST",
        targetType: "LeadMatch",
        targetId: match.id,
      },
    });

    return { match: updated, alreadyLost: false as const };
  });
}

/** Contractor confirms they received payment from the landowner → fee becomes DUE. */
export async function confirmContractorPaid(params: {
  leadMatchId: string;
  actorType?: string;
  actorId?: string | null;
}) {
  const before = await prisma.successFee.findUnique({
    where: { leadMatchId: params.leadMatchId },
    select: { status: true },
  });
  const fee = await markSuccessFeeDue(prisma, params.leadMatchId);

  await prisma.leadMatch.update({
    where: { id: params.leadMatchId },
    data: {
      followUpStage: FOLLOW_UP_STAGES.feeDue,
      followUpNextAt: null,
      followUpAttempts: 0,
    },
  });

  // First time the fee becomes due: send the login-free payment link.
  if (before?.status !== "DUE") {
    await sendFeeDueNotice(params.leadMatchId, 0).catch((error) =>
      console.error("[fee] due notice failed", error),
    );
  }

  await prisma.auditLog.create({
    data: {
      actorType: params.actorType ?? "contractor",
      actorId: params.actorId ?? null,
      action: "CONTRACTOR_PAYMENT_CONFIRMED",
      targetType: "LeadMatch",
      targetId: params.leadMatchId,
      metadata: { feeAmountCents: fee.feeAmountCents },
    },
  });

  return fee;
}

/** Send (or re-send) the "your success fee is due" message with a pay link. */
export async function sendFeeDueNotice(leadMatchId: string, reminderNumber: number) {
  const token = await createFollowUpToken(prisma, {
    action: FollowUpAction.PAY_FEE,
    leadMatchId,
  });
  const { notifyFeeDue } = await import("@/lib/notifications");
  await notifyFeeDue(leadMatchId, token.token, reminderNumber);
}

/** Contractor says not yet paid — schedule another reminder. */
export async function deferContractorPaymentCheck(leadMatchId: string) {
  const retryHours = await getFollowUpPaymentRetryHours(prisma);
  const followUpNextAt = new Date(Date.now() + retryHours * 3600 * 1000);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: FOLLOW_UP_STAGES.payment,
      followUpNextAt,
      followUpAttempts: 0,
    },
  });
}

/** After accept — schedule first outcome follow-up. */
export async function schedulePostAcceptFollowUp(leadMatchId: string) {
  const delayHours = await getFollowUpOutcomeDelayHours(prisma);
  const followUpNextAt = new Date(Date.now() + delayHours * 3600 * 1000);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: FOLLOW_UP_STAGES.outcome,
      followUpNextAt,
      followUpAttempts: 0,
    },
  });
}

export { scheduleOutcomeFollowUp, schedulePaymentFollowUp };
