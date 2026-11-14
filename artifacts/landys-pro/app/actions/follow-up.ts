"use server";

import { revalidatePath } from "next/cache";
import { FollowUpAction } from "@prisma/client";
import {
  reportJobWon,
  reportJobLost,
  confirmContractorPaid,
  deferContractorPaymentCheck,
} from "@/lib/domain/job-outcome";
import { markFollowUpTokenUsed, peekFollowUpToken } from "@/lib/domain/follow-up";
import { submitLandownerConfirmation } from "@/lib/domain/landowner-confirm";
import { DomainError } from "@/lib/domain/errors";

export type FollowUpResult =
  | { ok: true; status: string }
  | { ok: false; message: string };

/** Largest job price a contractor can report from a link (sanity bound). */
const MAX_JOB_VALUE_DOLLARS = 10_000_000;

function failure(e: unknown): FollowUpResult {
  return { ok: false, message: e instanceof DomainError ? e.message : "Something went wrong. Please try again." };
}

/**
 * Each action validates the link, performs the change, and only THEN marks the
 * link used — a mistyped amount never burns the link.
 */
export async function followUpReportWonAction(
  token: string,
  finalContractValueDollars: number,
): Promise<FollowUpResult> {
  if (
    !Number.isFinite(finalContractValueDollars) ||
    finalContractValueDollars <= 0 ||
    finalContractValueDollars > MAX_JOB_VALUE_DOLLARS
  ) {
    return { ok: false, message: "Enter the final job price in dollars, for example 4500." };
  }
  try {
    const row = await peekFollowUpToken(token, FollowUpAction.REPORT_OUTCOME);
    if (!row.leadMatchId) return { ok: false, message: "Invalid link." };
    const cents = Math.round(finalContractValueDollars * 100);
    await reportJobWon({ leadMatchId: row.leadMatchId, finalContractValueCents: cents });
    await markFollowUpTokenUsed(row.id);
    revalidatePath(`/follow-up/${token}`);
    return { ok: true, status: "won" };
  } catch (e) {
    return failure(e);
  }
}

export async function followUpReportLostAction(token: string): Promise<FollowUpResult> {
  try {
    const row = await peekFollowUpToken(token, FollowUpAction.REPORT_OUTCOME);
    if (!row.leadMatchId) return { ok: false, message: "Invalid link." };
    await reportJobLost({ leadMatchId: row.leadMatchId });
    await markFollowUpTokenUsed(row.id);
    revalidatePath(`/follow-up/${token}`);
    return { ok: true, status: "lost" };
  } catch (e) {
    return failure(e);
  }
}

export async function followUpConfirmPaidAction(token: string): Promise<FollowUpResult> {
  try {
    const row = await peekFollowUpToken(token, FollowUpAction.CONFIRM_PAID);
    if (!row.leadMatchId) return { ok: false, message: "Invalid link." };
    await confirmContractorPaid({ leadMatchId: row.leadMatchId });
    await markFollowUpTokenUsed(row.id);
    revalidatePath(`/follow-up/${token}`);
    return { ok: true, status: "fee_due" };
  } catch (e) {
    return failure(e);
  }
}

export async function followUpDeferPaidAction(token: string): Promise<FollowUpResult> {
  try {
    const row = await peekFollowUpToken(token, FollowUpAction.CONFIRM_PAID);
    if (!row.leadMatchId) return { ok: false, message: "Invalid link." };
    await deferContractorPaymentCheck(row.leadMatchId);
    await markFollowUpTokenUsed(row.id);
    revalidatePath(`/follow-up/${token}`);
    return { ok: true, status: "deferred" };
  } catch (e) {
    return failure(e);
  }
}

/**
 * Landowner answer. `choice` is a LeadMatch id ("I hired <pro>"), "none"
 * ("not hired anyone yet") or "other" ("someone else").
 */
export async function landownerConfirmAction(
  token: string,
  choice: string,
): Promise<FollowUpResult> {
  try {
    if (choice === "none") {
      await submitLandownerConfirmation({ token, hired: false });
    } else if (choice === "other") {
      await submitLandownerConfirmation({ token, hired: true, hiredLeadMatchId: null });
    } else {
      await submitLandownerConfirmation({ token, hired: true, hiredLeadMatchId: choice });
    }
    revalidatePath(`/follow-up/landowner/${token}`);
    return { ok: true, status: "recorded" };
  } catch (e) {
    return failure(e);
  }
}
