import { JobOutcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notifications";
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

  if (params.hired && !params.hiredLeadMatchId) {
    const anyWon = row.lead.matches.some((m) => m.jobOutcome === JobOutcome.WON);
    if (anyWon) {
      mismatchFlagged = true;
      mismatchReason = "Landowner hired someone else, but a contractor reported won.";
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

  if (mismatchFlagged) {
    await notifyAdmins({
      kind: "landowner_mismatch",
      title: "Homeowner answer does not match a contractor's report",
      lines: [mismatchReason ?? "Mismatch detected.", "Review it before collecting or waiving a success fee."],
      link: { label: "Open confirmations", path: "/admin/confirmations" },
      leadId: row.leadId,
    });
  }

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

export async function getAcceptedMatchesForLandowner(leadId: string) {
  return prisma.leadMatch.findMany({
    where: { leadId, status: "ACCEPTED" },
    include: {
      contractor: { select: { name: true } },
      lead: { include: leadDisplayInclude },
    },
  });
}
