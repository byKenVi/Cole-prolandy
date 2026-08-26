"use server";

import { revalidatePath } from "next/cache";
import { FollowUpAction } from "@prisma/client";
import {
  reportJobWon,
  reportJobLost,
  confirmContractorPaid,
  deferContractorPaymentCheck,
} from "@/lib/domain/job-outcome";
import { consumeFollowUpToken } from "@/lib/domain/follow-up";
import { submitLandownerConfirmation } from "@/lib/domain/landowner-confirm";
import { DomainError } from "@/lib/domain/errors";

export type FollowUpResult =
  | { ok: true; status: string }
  | { ok: false; message: string };

export async function followUpReportWonAction(
  token: string,
  finalContractValueDollars: number,
): Promise<FollowUpResult> {
  try {
    const row = await consumeFollowUpToken(token);
    if (row.action !== FollowUpAction.REPORT_OUTCOME || !row.leadMatchId) {
      return { ok: false, message: "Invalid link." };
    }
    const cents = Math.round(finalContractValueDollars * 100);
    await reportJobWon({ leadMatchId: row.leadMatchId, finalContractValueCents: cents });
    revalidatePath(`/follow-up/${token}`);
    return { ok: true, status: "won" };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Something went wrong." };
  }
}

export async function followUpReportLostAction(token: string): Promise<FollowUpResult> {
  try {
    const row = await consumeFollowUpToken(token);
    if (row.action !== FollowUpAction.REPORT_OUTCOME || !row.leadMatchId) {
      return { ok: false, message: "Invalid link." };
    }
    await reportJobLost({ leadMatchId: row.leadMatchId });
    return { ok: true, status: "lost" };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Something went wrong." };
  }
}

export async function followUpConfirmPaidAction(token: string): Promise<FollowUpResult> {
  try {
    const row = await consumeFollowUpToken(token);
    if (row.action !== FollowUpAction.CONFIRM_PAID || !row.leadMatchId) {
      return { ok: false, message: "Invalid link." };
    }
    await confirmContractorPaid({ leadMatchId: row.leadMatchId });
    return { ok: true, status: "fee_due" };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Something went wrong." };
  }
}

export async function followUpDeferPaidAction(token: string): Promise<FollowUpResult> {
  try {
    const row = await consumeFollowUpToken(token);
    if (row.action !== FollowUpAction.CONFIRM_PAID || !row.leadMatchId) {
      return { ok: false, message: "Invalid link." };
    }
    await deferContractorPaymentCheck(row.leadMatchId);
    return { ok: true, status: "deferred" };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Something went wrong." };
  }
}

export async function landownerConfirmAction(
  token: string,
  hired: boolean,
  hiredLeadMatchId?: string | null,
): Promise<FollowUpResult> {
  try {
    await submitLandownerConfirmation({ token, hired, hiredLeadMatchId: hiredLeadMatchId ?? null });
    return { ok: true, status: "recorded" };
  } catch (e) {
    return { ok: false, message: e instanceof DomainError ? e.message : "Something went wrong." };
  }
}
