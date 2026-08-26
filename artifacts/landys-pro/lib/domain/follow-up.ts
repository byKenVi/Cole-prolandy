import { FollowUpAction, JobOutcome, LeadMatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAcceptToken } from "@/lib/tokens";
import { appUrl } from "@/lib/app-url";
import type { DbClient } from "./types";
import { InvalidStateError, NotFoundError } from "./errors";
import {
  getFollowUpOutcomeDelayHours,
  getFollowUpPaymentDelayHours,
  getFollowUpPaymentRetryHours,
} from "./settings";

const TOKEN_TTL_DAYS = 30;

export function followUpLink(token: string): string {
  return `${appUrl()}/follow-up/${token}`;
}

export async function createFollowUpToken(
  db: DbClient,
  params: {
    action: FollowUpAction;
    leadMatchId?: string;
    leadId?: string;
  },
) {
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 3600 * 1000);
  return db.followUpToken.create({
    data: {
      token: generateAcceptToken(),
      action: params.action,
      leadMatchId: params.leadMatchId ?? null,
      leadId: params.leadId ?? null,
      expiresAt,
    },
  });
}

export async function consumeFollowUpToken(token: string) {
  const row = await prisma.followUpToken.findUnique({ where: { token } });
  if (!row) throw new NotFoundError("Follow-up link");
  if (row.usedAt) throw new InvalidStateError("This link has already been used.");
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new InvalidStateError("This link has expired.");
  }
  await prisma.followUpToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  return row;
}

export async function scheduleOutcomeFollowUp(leadMatchId: string) {
  const delayHours = await getFollowUpOutcomeDelayHours(prisma);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: "outcome_check",
      followUpNextAt: new Date(Date.now() + delayHours * 3600 * 1000),
    },
  });
}

export async function schedulePaymentFollowUp(leadMatchId: string) {
  const delayHours = await getFollowUpPaymentDelayHours(prisma);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: "payment_check",
      followUpNextAt: new Date(Date.now() + delayHours * 3600 * 1000),
    },
  });
}

export async function schedulePaymentRetry(leadMatchId: string) {
  const retryHours = await getFollowUpPaymentRetryHours(prisma);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: "awaiting_contractor_payment",
      followUpNextAt: new Date(Date.now() + retryHours * 3600 * 1000),
    },
  });
}

/** Find matches due for automated follow-up and return notification payloads. */
export async function findDueFollowUps(now: Date = new Date()) {
  const matches = await prisma.leadMatch.findMany({
    where: {
      status: LeadMatchStatus.ACCEPTED,
      followUpNextAt: { lte: now },
      followUpStage: { not: null },
    },
    include: {
      contractor: { select: { id: true, name: true, email: true, phone: true } },
      lead: {
        select: {
          id: true,
          propertyLocation: true,
          landownerName: true,
          workType: { select: { name: true } },
          projectType: { select: { name: true } },
        },
      },
      successFee: { select: { status: true } },
    },
    take: 50,
  });

  return matches.filter((m) => {
    if (m.followUpStage === "outcome_check" && m.jobOutcome !== JobOutcome.OPEN) {
      return false;
    }
    if (
      m.followUpStage === "payment_check" &&
      m.jobOutcome === JobOutcome.WON &&
      m.successFee?.status !== "AWAITING_CONTRACTOR_PAYMENT"
    ) {
      return false;
    }
    return true;
  });
}

export async function ensureLandownerConfirmation(leadId: string) {
  const existing = await prisma.landownerConfirmation.findUnique({ where: { leadId } });
  if (existing) return existing;
  return prisma.landownerConfirmation.create({
    data: {
      leadId,
      token: generateAcceptToken(),
    },
  });
}

export function landownerConfirmLink(token: string): string {
  return `${appUrl()}/follow-up/landowner/${token}`;
}
