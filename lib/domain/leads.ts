import type { Prisma } from "@prisma/client";
import { LeadMatchStatus, LeadStatus, WalletTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateAcceptToken } from "@/lib/tokens";
import type { DbClient } from "./types";
import { applyWalletTransactionInTx } from "./wallet";
import { getMaxLeadRecipients } from "./settings";
import {
  InvalidStateError,
  LeadExpiredError,
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
 * Distribute a lead to up to `maxLeadRecipients` eligible contractors by creating
 * PENDING LeadMatch rows. Leads are SHARED (business rule 1): all recipients may
 * accept independently; no exclusivity/lock.
 *
 * Eligibility: contractors assigned to the lead's project (ContractorProject),
 * not deactivated. Project assignment is multi-project and admin-controlled.
 *
 * Notifications are fired by the caller using the returned matches (keeps the
 * domain free of integration side effects).
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

  const maxRecipients = await getMaxLeadRecipients(db);
  const projectId = lead.projectType.contractorTypeId;

  const alreadyMatchedIds = new Set(lead.matches.map((m) => m.contractorId));

  const candidates = await db.contractor.findMany({
    where: {
      deactivatedAt: null,
      id: { notIn: Array.from(alreadyMatchedIds) },
      projects: { some: { contractorTypeId: projectId } },
    },
    // Stable creation order keeps distribution deterministic.
    orderBy: { createdAt: "asc" },
    take: Math.max(0, maxRecipients - alreadyMatchedIds.size),
    select: { id: true, name: true, email: true, phone: true },
  });

  const matches: DistributeLeadResult["matches"] = [];
  for (const c of candidates) {
    const match = await db.leadMatch.create({
      // Override the weak cuid() schema default with a crypto-random token —
      // this is the sole credential for the unauthenticated accept link.
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

/**
 * Charge a contractor for an accepted lead. Must run inside a transaction.
 * Debits the wallet via the single wallet mutation point; throws
 * InsufficientBalanceError if funds are too low (business rule 3).
 */
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
    landownerName: string;
    landownerEmail: string;
    landownerPhone: string;
    propertyLocation: string;
  };
};

/**
 * Accept a lead match. Charges the contractor and reveals landowner contact.
 * Idempotent: a second accept returns the existing accepted result without a
 * second charge. Same function backs both the logged-in app and the tokenized
 * SMS flow, keeping them in sync.
 */
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

    // Idempotent fast-path (first read, no lock yet).
    if (match.status === LeadMatchStatus.ACCEPTED) {
      return alreadyAcceptedResult(tx, match, contactPayload);
    }
    if (match.status === LeadMatchStatus.DECLINED) {
      throw new InvalidStateError("This lead was already passed on.");
    }

    // Expiry (business rule 6). Checked before the claim so an expired-but-still
    // -PENDING match can never be accepted.
    const isExpired =
      match.status === LeadMatchStatus.EXPIRED ||
      lead.status === LeadStatus.EXPIRED ||
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

    // ── Atomic claim: money-safety gate ──
    // Flip PENDING → ACCEPTED in a single guarded UPDATE (row lock). With two
    // concurrent accepts of the SAME match (SMS link + in-app tap, double-click),
    // exactly one wins (count === 1); the loser sees count === 0 and NEVER
    // charges. The charge runs only after a successful claim and shares this
    // transaction, so an insufficient-balance failure rolls the claim back to
    // PENDING.
    const claimed = await tx.leadMatch.updateMany({
      where: { id: match.id, status: LeadMatchStatus.PENDING },
      data: { status: LeadMatchStatus.ACCEPTED, acceptedAt: new Date() },
    });

    if (claimed.count === 0) {
      // Lost the race (or status changed since the first read). Re-read the
      // authoritative row and mirror the non-concurrent behavior exactly.
      const fresh = await tx.leadMatch.findUnique({ where: { id: match.id } });
      if (!fresh) throw new NotFoundError("Lead invite");
      if (fresh.status === LeadMatchStatus.ACCEPTED) {
        return alreadyAcceptedResult(tx, fresh, contactPayload);
      }
      if (fresh.status === LeadMatchStatus.DECLINED) {
        throw new InvalidStateError("This lead was already passed on.");
      }
      throw new LeadExpiredError();
    }

    // Winner only: charge (throws InsufficientBalanceError → rolls back claim).
    const charge = await chargeForLead(tx, {
      contractorId: match.contractorId,
      leadMatchId: match.id,
      priceCents: lead.priceCents,
    });

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

/** Build the idempotent "already accepted" response (contact revealed, no charge). */
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
      // Concurrent double-refund hits @@unique([leadMatchId, type]).
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

/**
 * Mark leads (and their pending matches) expired once past expiresAt.
 * Idempotent; safe to run on a schedule (cron) or on-demand.
 */
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
