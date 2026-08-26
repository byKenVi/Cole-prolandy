import { FollowUpAction, JobOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createFollowUpToken, findDueFollowUps } from "@/lib/domain/follow-up";
import { notifyOutcomeFollowUp, notifyPaymentFollowUp } from "@/lib/notifications";
import { leadDisplayInclude } from "@/lib/resolved-lead";
import { InvalidStateError, NotFoundError } from "./errors";

export async function submitLandownerConfirmation(params: {
  token: string;
  hired: boolean;
  hiredLeadMatchId?: string | null;
}) {
  const row = await prisma.landownerConfirmation.findUnique({
    where: { token: params.token },
    include: {
      lead: {
        include: {
          matches: {
            where: { status: "ACCEPTED" },
            select: { id: true, jobOutcome: true, contractor: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!row) throw new NotFoundError("Confirmation link");
  if (row.respondedAt) throw new InvalidStateError("This confirmation was already submitted.");

  let mismatchFlagged = false;
  let mismatchReason: string | null = null;

  if (params.hired && params.hiredLeadMatchId) {
    const hiredMatch = row.lead.matches.find((m) => m.id === params.hiredLeadMatchId);
    if (!hiredMatch) {
      throw new InvalidStateError("That contractor was not connected to this project.");
    }
    const wonElsewhere = row.lead.matches.filter(
      (m) => m.jobOutcome === JobOutcome.WON && m.id !== params.hiredLeadMatchId,
    );
    const lostButHired = hiredMatch.jobOutcome === JobOutcome.LOST;
    if (wonElsewhere.length > 0 || lostButHired) {
      mismatchFlagged = true;
      mismatchReason = lostButHired
        ? "Landowner hired a contractor who reported lost."
        : "Landowner hired a different contractor than one who reported won.";
    }
  }

  if (!params.hired) {
    const anyWon = row.lead.matches.some((m) => m.jobOutcome === JobOutcome.WON);
    if (anyWon) {
      mismatchFlagged = true;
      mismatchReason = "Contractor reported won but landowner did not hire.";
    }
  }

  const updated = await prisma.landownerConfirmation.update({
    where: { id: row.id },
    data: {
      hired: params.hired,
      hiredLeadMatchId: params.hired ? (params.hiredLeadMatchId ?? null) : null,
      respondedAt: new Date(),
      mismatchFlagged,
      mismatchReason,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "landowner",
      action: "LANDOWNER_CONFIRMATION",
      targetType: "Lead",
      targetId: row.leadId,
      metadata: {
        hired: params.hired,
        hiredLeadMatchId: params.hiredLeadMatchId ?? null,
        mismatchFlagged,
      },
    },
  });

  return updated;
}

/** Admin clears a mismatch flag after manual review — no automatic penalties. */
export async function resolveLandownerMismatch(params: {
  confirmationId: string;
  note?: string | null;
  adminId: string;
}) {
  const row = await prisma.landownerConfirmation.findUnique({
    where: { id: params.confirmationId },
  });
  if (!row) throw new NotFoundError("Confirmation");
  if (!row.mismatchFlagged) {
    throw new InvalidStateError("This confirmation is not flagged for mismatch review.");
  }

  const updated = await prisma.landownerConfirmation.update({
    where: { id: row.id },
    data: { mismatchFlagged: false },
  });

  await prisma.auditLog.create({
    data: {
      actorType: "admin",
      actorId: params.adminId,
      action: "MISMATCH_RESOLVED",
      targetType: "LandownerConfirmation",
      targetId: row.id,
      metadata: {
        leadId: row.leadId,
        note: params.note ?? null,
        priorReason: row.mismatchReason,
      },
    },
  });

  return updated;
}

export async function dispatchDueFollowUps(now: Date = new Date()) {
  const due = await findDueFollowUps(now);
  let sent = 0;

  for (const match of due) {
    const projectLabel =
      match.lead.workType?.name ?? match.lead.projectType?.name ?? "project";

    if (match.followUpStage === "outcome_check" && match.jobOutcome === JobOutcome.OPEN) {
      const token = await createFollowUpToken(prisma, {
        action: FollowUpAction.REPORT_OUTCOME,
        leadMatchId: match.id,
      });
      await notifyOutcomeFollowUp({
        contractor: match.contractor,
        token: token.token,
        projectLabel,
        location: match.lead.propertyLocation,
        leadMatchId: match.id,
      });
      await prisma.leadMatch.update({
        where: { id: match.id },
        data: { followUpNextAt: null },
      });
      sent += 1;
      continue;
    }

    if (
      match.followUpStage === "payment_check" &&
      match.jobOutcome === JobOutcome.WON &&
      match.successFee?.status === "AWAITING_CONTRACTOR_PAYMENT"
    ) {
      const token = await createFollowUpToken(prisma, {
        action: FollowUpAction.CONFIRM_PAID,
        leadMatchId: match.id,
      });
      await notifyPaymentFollowUp({
        contractor: match.contractor,
        token: token.token,
        projectLabel,
        leadMatchId: match.id,
      });
      await prisma.leadMatch.update({
        where: { id: match.id },
        data: { followUpNextAt: null },
      });
      sent += 1;
    }
  }

  return { sent, checked: due.length };
}

export async function getAcceptedMatchesForLandowner(leadId: string) {
  return prisma.leadMatch.findMany({
    where: { leadId, status: "ACCEPTED" },
    include: {
      contractor: { select: { name: true } },
      lead: { include: leadDisplayInclude },
    },
  });
}
