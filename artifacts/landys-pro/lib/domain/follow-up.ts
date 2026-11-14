import { FollowUpAction } from "@prisma/client";
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

/**
 * Follow-up stages stored on LeadMatch.followUpStage:
 *   outcome_check              → waiting for "did you get the job?"
 *   awaiting_contractor_payment→ won; waiting for "has the homeowner paid you?"
 *   fee_due                    → contractor confirmed paid; Landy's fee is due
 *   outcome_no_response / payment_no_response → reminders exhausted, admin alerted
 */
export const FOLLOW_UP_STAGES = {
  outcome: "outcome_check",
  payment: "awaiting_contractor_payment",
  /** Older rows used this name for the payment stage. */
  paymentLegacy: "payment_check",
  feeDue: "fee_due",
  outcomeNoResponse: "outcome_no_response",
  paymentNoResponse: "payment_no_response",
} as const;

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

/**
 * Validate a follow-up link WITHOUT using it up. The link is only marked used
 * once the action it triggers has succeeded (see `markFollowUpTokenUsed`), so a
 * typo in the job price never locks the contractor out.
 */
export async function peekFollowUpToken(token: string, expected?: FollowUpAction) {
  const row = await prisma.followUpToken.findUnique({ where: { token } });
  if (!row) throw new NotFoundError("Follow-up link");
  if (expected && row.action !== expected) throw new InvalidStateError("This link is not valid for this step.");
  if (row.usedAt) throw new InvalidStateError("This link has already been used.");
  if (row.expiresAt.getTime() <= Date.now()) {
    throw new InvalidStateError("This link has expired.");
  }
  return row;
}

export async function markFollowUpTokenUsed(id: string) {
  await prisma.followUpToken.updateMany({
    where: { id, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/** Validate and immediately use up a link (kept for one-step actions). */
export async function consumeFollowUpToken(token: string) {
  const row = await peekFollowUpToken(token);
  await markFollowUpTokenUsed(row.id);
  return row;
}

export async function scheduleOutcomeFollowUp(leadMatchId: string) {
  const delayHours = await getFollowUpOutcomeDelayHours(prisma);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: FOLLOW_UP_STAGES.outcome,
      followUpAttempts: 0,
      followUpNextAt: new Date(Date.now() + delayHours * 3600 * 1000),
    },
  });
}

export async function schedulePaymentFollowUp(leadMatchId: string) {
  const delayHours = await getFollowUpPaymentDelayHours(prisma);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: FOLLOW_UP_STAGES.payment,
      followUpAttempts: 0,
      followUpNextAt: new Date(Date.now() + delayHours * 3600 * 1000),
    },
  });
}

export async function schedulePaymentRetry(leadMatchId: string) {
  const retryHours = await getFollowUpPaymentRetryHours(prisma);
  await prisma.leadMatch.update({
    where: { id: leadMatchId },
    data: {
      followUpStage: FOLLOW_UP_STAGES.payment,
      followUpAttempts: 0,
      followUpNextAt: new Date(Date.now() + retryHours * 3600 * 1000),
    },
  });
}

export function landownerConfirmLink(token: string): string {
  return `${appUrl()}/follow-up/landowner/${token}`;
}
