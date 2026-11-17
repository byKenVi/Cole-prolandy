import type { Prisma } from "@prisma/client";
import { LeadMatchStatus, LeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAcceptToken } from "@/lib/tokens";
import type { DbClient } from "./types";
import { getAcceptanceUnlimited, getServiceRadiusMiles } from "./settings";
import { selectContractorsForZip } from "./service-area";
import {
  InvalidStateError,
  LeadExpiredError,
  LeadSoldOutError,
  NotFoundError,
} from "./errors";

// ─────────────────────────────────────────────────────────────
// Distribution
// ─────────────────────────────────────────────────────────────

export type DistributeLeadResult = {
  leadId: string;
  /** True when no contractor with a declared service area covered the lead. */
  usedFallback: boolean;
  matches: {
    id: string;
    contractorId: string;
    acceptToken: string;
    contractor: { id: string; name: string; email: string; phone: string };
  }[];
};

function categoryFilter(categoryId: string): Prisma.ContractorWhereInput {
  return {
    OR: [
      { contractorCategoryId: categoryId },
      { categoryMemberships: { some: { categoryId } } },
    ],
  };
}

/** Not deactivated and not on a self-declared pause. */
function availableNow(now: Date): Prisma.ContractorWhereInput {
  return {
    deactivatedAt: null,
    OR: [{ leadsPausedUntil: null }, { leadsPausedUntil: { lt: now } }],
  };
}

/**
 * Distribute a lead to ALL eligible contractors by creating PENDING LeadMatch rows.
 * Live intake: same category (primary or secondary) AND service area covering
 * the property ZIP (contractors without any service area are a fallback).
 * Work types from landys.co are informative and do not restrict matching.
 * Legacy intake: project assignment + optional category filter.
 */
export async function distributeLead(
  db: DbClient,
  leadId: string,
): Promise<DistributeLeadResult> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { projectType: true, workType: true, matches: true },
  });
  if (!lead) throw new NotFoundError("Lead");
  if (lead.expiresAt === null || lead.contractorReviewRequired) {
    throw new InvalidStateError("This lead is still awaiting intake review.");
  }
  if (lead.status === LeadStatus.SOLD_OUT || lead.status === LeadStatus.EXPIRED) {
    throw new InvalidStateError("This lead is no longer available for distribution.");
  }

  const alreadyMatchedIds = new Set(lead.matches.map((m) => m.contractorId));
  const now = new Date();
  let usedFallback = false;
  let candidates: Array<{
    id: string;
    name: string;
    email: string;
    phone: string;
  }>;

  if (lead.workTypeId || !lead.projectTypeId) {
    if (!lead.contractorCategoryId) {
      throw new InvalidStateError("General live leads require a contractor category.");
    }
    const rows = await db.contractor.findMany({
      where: {
        id: { notIn: Array.from(alreadyMatchedIds) },
        AND: [availableNow(now), categoryFilter(lead.contractorCategoryId)],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        serviceZipCodes: true,
        serviceCounties: true,
        serviceRadiusMiles: true,
      },
    });
    const radius = await getServiceRadiusMiles(db);
    const selection = await selectContractorsForZip(
      rows,
      lead.propertyZip ?? lead.propertyLocation,
      radius,
    );
    usedFallback = selection.usedFallback;
    candidates = selection.eligible;
  } else {
    if (!lead.projectType) {
      throw new InvalidStateError("Legacy leads require a project type.");
    }
    const projectId = lead.projectType.contractorTypeId;
    const legacyCategoryFilter = lead.contractorCategoryId
      ? categoryFilter(lead.contractorCategoryId)
      : {};
    candidates = await db.contractor.findMany({
      where: {
        id: { notIn: Array.from(alreadyMatchedIds) },
        projects: { some: { contractorTypeId: projectId } },
        AND: [availableNow(now), legacyCategoryFilter],
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, email: true, phone: true },
    });
  }

  const matches: DistributeLeadResult["matches"] = [];
  for (const c of candidates) {
    const match = await db.leadMatch.create({
      data: {
        leadId,
        contractorId: c.id,
        status: LeadMatchStatus.PENDING,
        acceptToken: generateAcceptToken(),
      },
      select: { id: true, contractorId: true, acceptToken: true },
    });
    matches.push({
      ...match,
      contractor: { id: c.id, name: c.name, email: c.email, phone: c.phone },
    });
  }

  if (matches.length > 0 && lead.status === LeadStatus.NEW) {
    await db.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.DISTRIBUTED },
    });
  }

  return { leadId, matches, usedFallback };
}

// ─────────────────────────────────────────────────────────────
// Accept
// ─────────────────────────────────────────────────────────────

export type AcceptLeadMatchInput = {
  leadMatchId?: string;
  acceptToken?: string;
  actorType?: "contractor" | "admin" | "system";
  actorId?: string | null;
  /** Success-fee terms shown next to the Accept button (recorded as proof). */
  termsShown?: { version: string; feeRateLabel: string | null } | null;
};

export type AcceptLeadMatchResult = {
  status: "accepted" | "already_accepted";
  leadMatchId: string;
  contact: {
    landownerName: string | null;
    landownerEmail: string;
    landownerPhone: string | null;
    propertyLocation: string;
  };
};

async function isAcceptanceCapReached(
  tx: Prisma.TransactionClient,
  lead: { id: string; acceptedCount: number; maxPurchases: number; status: LeadStatus },
): Promise<boolean> {
  const unlimited = await getAcceptanceUnlimited(tx);
  if (unlimited) return false;
  return lead.status === LeadStatus.SOLD_OUT || lead.acceptedCount >= lead.maxPurchases;
}

export async function acceptLeadMatch(
  input: AcceptLeadMatchInput,
): Promise<AcceptLeadMatchResult> {
  const result = await prisma.$transaction(async (tx) => {
    const match = await findMatch(tx, input);

    const contractor = await tx.contractor.findUnique({
      where: { id: match.contractorId },
      select: { deactivatedAt: true },
    });
    if (contractor?.deactivatedAt) {
      throw new InvalidStateError("This contractor account is deactivated.");
    }

    const lead = await tx.lead.findUnique({ where: { id: match.leadId } });
    if (!lead) throw new NotFoundError("Lead");

    const contactPayload = {
      landownerName: lead.landownerName,
      landownerEmail: lead.landownerEmail,
      landownerPhone: lead.landownerPhone,
      propertyLocation: lead.propertyLocation,
    };

    if (match.status === LeadMatchStatus.ACCEPTED) {
      return { status: "already_accepted" as const, leadMatchId: match.id, contact: contactPayload };
    }
    if (match.status === LeadMatchStatus.DECLINED) {
      throw new InvalidStateError("This opportunity was already passed on.");
    }
    if (match.status === LeadMatchStatus.SOLD_OUT) {
      throw new LeadSoldOutError();
    }

    const isExpired =
      match.status === LeadMatchStatus.EXPIRED ||
      lead.status === LeadStatus.EXPIRED ||
      lead.expiresAt === null ||
      lead.expiresAt.getTime() <= Date.now();
    if (isExpired) {
      if (match.status === LeadMatchStatus.PENDING) {
        await tx.leadMatch.update({
          where: { id: match.id },
          data: { status: LeadMatchStatus.EXPIRED },
        });
      }
      throw new LeadExpiredError();
    }

    if (await isAcceptanceCapReached(tx, lead)) {
      if (match.status === LeadMatchStatus.PENDING) {
        await tx.leadMatch.update({
          where: { id: match.id },
          data: { status: LeadMatchStatus.SOLD_OUT },
        });
      }
      throw new LeadSoldOutError();
    }

    const claimed = await tx.leadMatch.updateMany({
      where: { id: match.id, status: LeadMatchStatus.PENDING },
      data: { status: LeadMatchStatus.ACCEPTED, acceptedAt: new Date() },
    });

    if (claimed.count === 0) {
      const fresh = await tx.leadMatch.findUnique({ where: { id: match.id } });
      if (!fresh) throw new NotFoundError("Lead invite");
      if (fresh.status === LeadMatchStatus.ACCEPTED) {
        return { status: "already_accepted" as const, leadMatchId: match.id, contact: contactPayload };
      }
      if (fresh.status === LeadMatchStatus.SOLD_OUT) throw new LeadSoldOutError();
      if (fresh.status === LeadMatchStatus.DECLINED) {
        throw new InvalidStateError("This opportunity was already passed on.");
      }
      throw new LeadExpiredError();
    }

    const unlimited = await getAcceptanceUnlimited(tx);
    if (!unlimited) {
      const slot = await tx.lead.updateMany({
        where: {
          id: lead.id,
          acceptedCount: { lt: lead.maxPurchases },
          status: { in: [LeadStatus.NEW, LeadStatus.DISTRIBUTED] },
        },
        data: { acceptedCount: { increment: 1 } },
      });

      if (slot.count === 0) {
        await tx.leadMatch.update({
          where: { id: match.id },
          data: { status: LeadMatchStatus.PENDING, acceptedAt: null },
        });
        throw new LeadSoldOutError();
      }

      const updatedLead = await tx.lead.findUnique({ where: { id: lead.id } });
      if (
        updatedLead &&
        updatedLead.acceptedCount >= updatedLead.maxPurchases &&
        updatedLead.status !== LeadStatus.SOLD_OUT
      ) {
        const now = new Date();
        await tx.lead.update({
          where: { id: lead.id },
          data: { status: LeadStatus.SOLD_OUT, soldOutAt: now },
        });
        await tx.leadMatch.updateMany({
          where: { leadId: lead.id, status: LeadMatchStatus.PENDING },
          data: { status: LeadMatchStatus.SOLD_OUT },
        });
      }
    } else {
      await tx.lead.update({
        where: { id: lead.id },
        data: { acceptedCount: { increment: 1 } },
      });
    }

    await tx.contractor.updateMany({
      where: { id: match.contractorId, termsAcceptedAt: null },
      data: { termsAcceptedAt: new Date() },
    });

    await writeAudit(tx, {
      actorType: input.actorType ?? "contractor",
      actorId: input.actorId ?? match.contractorId,
      action: "LEAD_ACCEPTED",
      targetType: "LeadMatch",
      targetId: match.id,
      metadata: {
        leadId: lead.id,
        contractorId: match.contractorId,
        termsVersion: input.termsShown?.version ?? null,
        feeRateShown: input.termsShown?.feeRateLabel ?? null,
        via: input.acceptToken ? "link" : "portal",
      },
    });

    return { status: "accepted" as const, leadMatchId: match.id, contact: contactPayload };
  });

  if (result.status === "accepted") {
    const { schedulePostAcceptFollowUp } = await import("./job-outcome");
    const { afterContractorAccepted } = await import("@/lib/services/landowner-confirmation");
    await schedulePostAcceptFollowUp(result.leadMatchId).catch((error) =>
      console.error("[accept] follow-up scheduling failed", error),
    );
    await afterContractorAccepted(result.leadMatchId).catch((error) =>
      console.error("[accept] landowner notification failed", error),
    );
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Decline
// ─────────────────────────────────────────────────────────────

export async function declineLeadMatch(
  input: AcceptLeadMatchInput,
): Promise<{ status: "declined" | "already_declined"; leadMatchId: string }> {
  return prisma.$transaction(async (tx) => {
    const match = await findMatch(tx, input);

    if (match.status === LeadMatchStatus.DECLINED) {
      return { status: "already_declined", leadMatchId: match.id };
    }
    if (match.status === LeadMatchStatus.ACCEPTED) {
      throw new InvalidStateError("This opportunity was already accepted.");
    }
    if (match.status === LeadMatchStatus.SOLD_OUT) {
      throw new LeadSoldOutError();
    }

    await tx.leadMatch.update({
      where: { id: match.id },
      data: { status: LeadMatchStatus.DECLINED },
    });

    await writeAudit(tx, {
      actorType: input.actorType ?? "contractor",
      actorId: input.actorId ?? match.contractorId,
      action: "LEAD_DECLINED",
      targetType: "LeadMatch",
      targetId: match.id,
      metadata: { leadId: match.leadId },
    });

    return { status: "declined", leadMatchId: match.id };
  });
}

// ─────────────────────────────────────────────────────────────
// Expiry sweep
// ─────────────────────────────────────────────────────────────

export async function expireLeads(
  db: DbClient,
  now: Date = new Date(),
): Promise<{ expiredLeads: number; expiredMatches: number }> {
  const stale = await db.lead.findMany({
    where: {
      expiresAt: { lt: now },
      status: { in: [LeadStatus.NEW, LeadStatus.DISTRIBUTED] },
    },
    select: { id: true },
  });
  const staleIds = stale.map((l) => l.id);
  if (staleIds.length === 0) return { expiredLeads: 0, expiredMatches: 0 };

  const matchRes = await db.leadMatch.updateMany({
    where: { leadId: { in: staleIds }, status: LeadMatchStatus.PENDING },
    data: { status: LeadMatchStatus.EXPIRED },
  });

  const leadRes = await db.lead.updateMany({
    where: { id: { in: staleIds } },
    data: { status: LeadStatus.EXPIRED },
  });

  return { expiredLeads: leadRes.count, expiredMatches: matchRes.count };
}

async function findMatch(
  tx: Prisma.TransactionClient,
  input: AcceptLeadMatchInput,
) {
  if (input.acceptToken) {
    const m = await tx.leadMatch.findUnique({
      where: { acceptToken: input.acceptToken },
    });
    if (!m) throw new NotFoundError("Lead invite");
    return m;
  }
  if (input.leadMatchId) {
    const m = await tx.leadMatch.findUnique({ where: { id: input.leadMatchId } });
    if (!m) throw new NotFoundError("Lead invite");
    return m;
  }
  throw new InvalidStateError("A lead match id or accept token is required.");
}

async function writeAudit(
  tx: Prisma.TransactionClient,
  data: {
    actorType: string;
    actorId?: string | null;
    action: string;
    targetType?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await tx.auditLog.create({
    data: {
      actorType: data.actorType,
      actorId: data.actorId ?? null,
      action: data.action,
      targetType: data.targetType ?? null,
      targetId: data.targetId ?? null,
      metadata: (data.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
