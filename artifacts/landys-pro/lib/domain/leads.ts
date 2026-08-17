import type { Prisma } from "@prisma/client";
import { LeadMatchStatus, LeadStatus, WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAcceptToken } from "@/lib/tokens";
import type { DbClient } from "./types";
import { applyWalletTransactionInTx } from "./wallet";
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
  matches: {
    id: string;
    contractorId: string;
    acceptToken: string;
    contractor: { id: string; name: string; email: string; phone: string };
  }[];
};

/**
 * Distribute a lead to ALL eligible contractors by creating PENDING LeadMatch rows.
 * Eligibility: active, assigned to lead project type, and (when set) contractor category.
 */
export async function distributeLead(
  db: DbClient,
  leadId: string,
): Promise<DistributeLeadResult> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    include: { projectType: true, matches: true },
  });
  if (!lead) throw new NotFoundError("Lead");
  if (
    lead.tier === null ||
    lead.priceCents === null ||
    lead.expiresAt === null ||
    lead.tierReviewRequired ||
    lead.budgetReviewRequired ||
    lead.contractorReviewRequired
  ) {
    throw new InvalidStateError("This lead is still awaiting intake review.");
  }
  if (lead.status === LeadStatus.SOLD_OUT || lead.status === LeadStatus.EXPIRED) {
    throw new InvalidStateError("This lead is no longer available for distribution.");
  }

  const projectId = lead.projectType.contractorTypeId;
  const alreadyMatchedIds = new Set(lead.matches.map((m) => m.contractorId));

  const categoryFilter = lead.contractorCategoryId
    ? {
        OR: [
          { contractorCategoryId: lead.contractorCategoryId },
          {
            categoryMemberships: {
              some: { categoryId: lead.contractorCategoryId },
            },
          },
        ],
      }
    : {};

  const candidates = await db.contractor.findMany({
    where: {
      deactivatedAt: null,
      id: { notIn: Array.from(alreadyMatchedIds) },
      projects: { some: { contractorTypeId: projectId } },
      ...categoryFilter,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, phone: true },
  });

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
    matches.push({ ...match, contractor: c });
  }

  if (matches.length > 0 && lead.status === LeadStatus.NEW) {
    await db.lead.update({
      where: { id: leadId },
      data: { status: LeadStatus.DISTRIBUTED },
    });
  }

  return { leadId, matches };
}

// ─────────────────────────────────────────────────────────────
// Charge (used inside accept)
// ─────────────────────────────────────────────────────────────

export async function chargeForLead(
  tx: Prisma.TransactionClient,
  params: { contractorId: string; leadMatchId: string; priceCents: number },
) {
  return applyWalletTransactionInTx(tx, {
    contractorId: params.contractorId,
    amountCents: -Math.abs(params.priceCents),
    type: WalletTransactionType.LEAD_CHARGE,
    leadMatchId: params.leadMatchId,
  });
}

// ─────────────────────────────────────────────────────────────
// Accept
// ─────────────────────────────────────────────────────────────

export type AcceptLeadMatchInput = {
  leadMatchId?: string;
  acceptToken?: string;
  actorType?: "contractor" | "admin" | "system";
  actorId?: string | null;
};

export type AcceptLeadMatchResult = {
  status: "accepted" | "already_accepted";
  leadMatchId: string;
  newBalanceCents: number;
  contact: {
    landownerName: string | null;
    landownerEmail: string;
    landownerPhone: string | null;
    propertyLocation: string;
  };
};

export async function acceptLeadMatch(
  input: AcceptLeadMatchInput,
): Promise<AcceptLeadMatchResult> {
  return prisma.$transaction(async (tx) => {
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
      return alreadyAcceptedResult(tx, match, contactPayload);
    }
    if (match.status === LeadMatchStatus.DECLINED) {
      throw new InvalidStateError("This lead was already passed on.");
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

    if (lead.status === LeadStatus.SOLD_OUT || lead.acceptedCount >= lead.maxPurchases) {
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
        return alreadyAcceptedResult(tx, fresh, contactPayload);
      }
      if (fresh.status === LeadMatchStatus.SOLD_OUT) throw new LeadSoldOutError();
      if (fresh.status === LeadMatchStatus.DECLINED) {
        throw new InvalidStateError("This lead was already passed on.");
      }
      throw new LeadExpiredError();
    }

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

    if (lead.priceCents === null) {
      await tx.lead.update({
        where: { id: lead.id },
        data: { acceptedCount: { decrement: 1 } },
      });
      await tx.leadMatch.update({
        where: { id: match.id },
        data: { status: LeadMatchStatus.PENDING, acceptedAt: null },
      });
      throw new InvalidStateError("This lead has no resolved price snapshot.");
    }

    let charge;
    try {
      charge = await chargeForLead(tx, {
        contractorId: match.contractorId,
        leadMatchId: match.id,
        priceCents: lead.priceCents,
      });
    } catch (error) {
      await tx.lead.update({
        where: { id: lead.id },
        data: { acceptedCount: { decrement: 1 } },
      });
      await tx.leadMatch.update({
        where: { id: match.id },
        data: { status: LeadMatchStatus.PENDING, acceptedAt: null },
      });
      throw error;
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

    await writeAudit(tx, {
      actorType: input.actorType ?? "contractor",
      actorId: input.actorId ?? match.contractorId,
      action: "LEAD_ACCEPTED",
      targetType: "LeadMatch",
      targetId: match.id,
      metadata: { leadId: lead.id, priceCents: lead.priceCents },
    });

    return {
      status: "accepted",
      leadMatchId: match.id,
      newBalanceCents: charge.newBalanceCents,
      contact: contactPayload,
    };
  });
}

async function alreadyAcceptedResult(
  tx: Prisma.TransactionClient,
  match: { id: string; contractorId: string },
  contact: AcceptLeadMatchResult["contact"],
): Promise<AcceptLeadMatchResult> {
  const contractor = await tx.contractor.findUnique({
    where: { id: match.contractorId },
    select: { walletBalanceCents: true },
  });
  return {
    status: "already_accepted",
    leadMatchId: match.id,
    newBalanceCents: contractor?.walletBalanceCents ?? 0,
    contact,
  };
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
      throw new InvalidStateError("This lead was already accepted.");
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
// Refund (admin)
// ─────────────────────────────────────────────────────────────

export async function refundLeadMatch(params: {
  leadMatchId: string;
  reason?: string;
  actorId?: string | null;
}): Promise<{ refundedCents: number; newBalanceCents: number }> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.leadMatch.findUnique({
      where: { id: params.leadMatchId },
      include: { lead: true, walletTransactions: true },
    });
    if (!match) throw new NotFoundError("LeadMatch");
    if (match.status !== LeadMatchStatus.ACCEPTED) {
      throw new InvalidStateError("Only accepted leads can be refunded.");
    }

    const alreadyRefunded = match.walletTransactions.some(
      (t) => t.type === WalletTransactionType.REFUND,
    );
    if (alreadyRefunded) {
      throw new InvalidStateError("This lead charge was already refunded.");
    }

    const charge = match.walletTransactions.find(
      (t) => t.type === WalletTransactionType.LEAD_CHARGE,
    );
    const refundCents = charge ? Math.abs(charge.amountCents) : match.lead.priceCents;
    if (refundCents === null) {
      throw new InvalidStateError("This lead has no price snapshot to refund.");
    }

    let res;
    try {
      res = await applyWalletTransactionInTx(tx, {
        contractorId: match.contractorId,
        amountCents: refundCents,
        type: WalletTransactionType.REFUND,
        leadMatchId: match.id,
        note: params.reason ?? "Lead charge refunded",
      });
    } catch (e) {
      if (
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        (e as { code?: string }).code === "P2002"
      ) {
        throw new InvalidStateError("This lead charge was already refunded.");
      }
      throw e;
    }

    await writeAudit(tx, {
      actorType: "admin",
      actorId: params.actorId ?? null,
      action: "LEAD_REFUNDED",
      targetType: "LeadMatch",
      targetId: match.id,
      metadata: { refundCents, reason: params.reason ?? null },
    });

    return { refundedCents: refundCents, newBalanceCents: res.newBalanceCents };
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

// ─────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────

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
