"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { DomainError } from "@/lib/domain/errors";
import {
  reportJobWon,
  reportJobLost,
  confirmContractorPaid,
  deferContractorPaymentCheck,
} from "@/lib/domain/job-outcome";
import { prisma } from "@/lib/prisma";

export type ActionResult =
  | { ok: true; status: string }
  | { ok: false; code: string; message: string };

async function assertOwnMatch(leadMatchId: string): Promise<ActionResult | null> {
  const session = await getSession();
  if (!session.contractorId) {
    return { ok: false, code: "UNAUTHORIZED", message: "Sign in as a contractor to continue." };
  }
  const match = await prisma.leadMatch.findUnique({
    where: { id: leadMatchId },
    select: { contractorId: true },
  });
  if (!match || match.contractorId !== session.contractorId) {
    return { ok: false, code: "FORBIDDEN", message: "You cannot act on this job." };
  }
  return null;
}

export async function reportWonAction(
  leadMatchId: string,
  finalContractValueCents: number,
): Promise<ActionResult> {
  const denied = await assertOwnMatch(leadMatchId);
  if (denied) return denied;
  const session = await getSession();
  try {
    const res = await reportJobWon({
      leadMatchId,
      finalContractValueCents,
      actorId: session.contractorId,
    });
    revalidatePath("/jobs");
    revalidatePath("/fees");
    revalidatePath("/dashboard");
    return { ok: true, status: res.alreadyWon ? "already_won" : "won" };
  } catch (e) {
    return toResult(e);
  }
}

export async function reportLostAction(leadMatchId: string): Promise<ActionResult> {
  const denied = await assertOwnMatch(leadMatchId);
  if (denied) return denied;
  const session = await getSession();
  try {
    const res = await reportJobLost({ leadMatchId, actorId: session.contractorId });
    revalidatePath("/jobs");
    revalidatePath("/dashboard");
    return { ok: true, status: res.alreadyLost ? "already_lost" : "lost" };
  } catch (e) {
    return toResult(e);
  }
}

export async function confirmPaidAction(leadMatchId: string): Promise<ActionResult> {
  const denied = await assertOwnMatch(leadMatchId);
  if (denied) return denied;
  const session = await getSession();
  try {
    await confirmContractorPaid({ leadMatchId, actorId: session.contractorId });
    revalidatePath("/jobs");
    revalidatePath("/fees");
    return { ok: true, status: "fee_due" };
  } catch (e) {
    return toResult(e);
  }
}

export async function deferPaidAction(leadMatchId: string): Promise<ActionResult> {
  const denied = await assertOwnMatch(leadMatchId);
  if (denied) return denied;
  try {
    await deferContractorPaymentCheck(leadMatchId);
    return { ok: true, status: "deferred" };
  } catch (e) {
    return toResult(e);
  }
}

function toResult(e: unknown): ActionResult {
  if (e instanceof DomainError) {
    return { ok: false, code: e.code, message: e.message };
  }
  return { ok: false, code: "UNKNOWN", message: "Something went wrong. Please try again." };
}
