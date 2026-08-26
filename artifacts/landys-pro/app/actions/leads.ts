"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { acceptLeadMatch, declineLeadMatch } from "@/lib/domain/leads";
import { DomainError } from "@/lib/domain/errors";
import { getSession } from "@/lib/auth";
import { revalidateContractorShell } from "@/lib/revalidate";

export type ActionResult =
  | { ok: true; status: string }
  | { ok: false; code: string; message: string };

async function assertOwnMatch(leadMatchId: string, contractorId: string | null): Promise<ActionResult | null> {
  if (!contractorId) {
    return { ok: false, code: "UNAUTHORIZED", message: "Sign in as a contractor to continue." };
  }
  const match = await prisma.leadMatch.findUnique({
    where: { id: leadMatchId },
    select: { contractorId: true },
  });
  if (!match || match.contractorId !== contractorId) {
    return { ok: false, code: "FORBIDDEN", message: "You cannot act on this opportunity." };
  }
  return null;
}

export async function acceptLeadAction(leadMatchId: string): Promise<ActionResult> {
  const session = await getSession();
  const denied = await assertOwnMatch(leadMatchId, session.contractorId);
  if (denied) return denied;
  try {
    const res = await acceptLeadMatch({
      leadMatchId,
      actorType: session.role === "admin" ? "admin" : "contractor",
      actorId: session.contractorId,
    });
    revalidatePath("/opportunities");
    revalidatePath("/dashboard");
    revalidatePath(`/jobs/${leadMatchId}`);
    revalidateContractorShell();
    return { ok: true, status: res.status };
  } catch (e) {
    return toResult(e);
  }
}

export async function declineLeadAction(leadMatchId: string): Promise<ActionResult> {
  const session = await getSession();
  const denied = await assertOwnMatch(leadMatchId, session.contractorId);
  if (denied) return denied;
  try {
    const res = await declineLeadMatch({
      leadMatchId,
      actorType: session.role === "admin" ? "admin" : "contractor",
      actorId: session.contractorId,
    });
    revalidatePath("/opportunities");
    revalidatePath("/dashboard");
    return { ok: true, status: res.status };
  } catch (e) {
    return toResult(e);
  }
}

export async function acceptByTokenAction(acceptToken: string): Promise<ActionResult> {
  try {
    const res = await acceptLeadMatch({ acceptToken, actorType: "contractor" });
    revalidatePath(`/accept/${acceptToken}`);
    return { ok: true, status: res.status };
  } catch (e) {
    return toResult(e);
  }
}

export async function declineByTokenAction(acceptToken: string): Promise<ActionResult> {
  try {
    const res = await declineLeadMatch({ acceptToken, actorType: "contractor" });
    revalidatePath(`/accept/${acceptToken}`);
    return { ok: true, status: res.status };
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
