import { after } from "next/server";
import {
  LeadMatchStatus,
  LeadReviewStatus,
  LeadRoutingMode,
  LeadStatus,
  type BudgetBand,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { distributeLead } from "@/lib/domain/leads";
import { inferBudgetBandFromCents, resolveLeadBudget } from "@/lib/domain/budget";
import { resolveTierForBudgetBand } from "@/lib/domain/tier-resolution";
import { REVIEW_BLOCKERS } from "@/lib/taxonomy/live-v3";
import { resolveTaxonomyInputs } from "@/lib/services/live-taxonomy-resolution";
import { ensureCategory, ensureLandType, ensureWorkType } from "@/lib/services/taxonomy-registry";
import { resolvePrice } from "@/lib/domain/pricing";
import { getLeadExpiryHours, getMaxLeadPurchases } from "@/lib/domain/settings";
import { DomainError, InvalidStateError, NotFoundError } from "@/lib/domain/errors";
import type { DbClient } from "@/lib/domain/types";
import { notifyAdmins, notifyContractorsOfNewLead } from "@/lib/notifications";
import { generateAcceptToken } from "@/lib/tokens";
import type { WixEstimateAttachment } from "@/lib/integrations/wix/estimate-contract";
import { ingestLeadAttachments } from "@/lib/services/lead-attachments";
import { resolveWixContractorExternalId } from "@/lib/integrations/wix/contractor-id-resolver";

/**
 * Lead intake and routing (success-fee model).
 *
 * Principles:
 *  - a request from landys.co is NEVER lost: it is stored first, then routed;
 *  - unknown taxonomy labels are created, not rejected (landys.co is the source of truth);
 *  - budget is informative only and never blocks routing;
 *  - anything that prevents routing holds the lead for admin review AND alerts admins.
 */

export type LeadIntakeInput = {
  landownerName: string;
  landownerEmail: string;
  landownerPhone: string;
  propertyLocation: string;
  description?: string | null;
  projectTypeId: string;
  tier: number;
  landTypeId?: string | null;
  source?: string;
  budgetCents?: number | null;
};

export type LeadIntakeResult = {
  leadId: string;
  priceCents: number;
  recipients: number;
};

export type OfficialEstimateIntakeInput = {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email: string;
  propertyZip: string;
  contractorCategoryCode?: string | null;
  landTypeCode: string;
  projectTypeCode: string;
  budget?: string | null;
  budgetCents?: number | null;
  budgetBand?: string | null;
  timeline?: Date | null;
  timelineRaw?: string | null;
  urgency?: string | null;
  description?: string | null;
  attachments?: WixEstimateAttachment[];
  source: string;
  externalRequestId?: string | null;
  payloadHash?: string | null;
  routing:
    | { mode: "general" }
    | { mode: "direct"; contractorSource: string; contractorExternalId: string };
};

export type IntakeBlocker =
  | "budget_review"
  | "pricing_review"
  | "contractor_review"
  | "category_review"
  | "no_matching_contractor"
  | "routing_error"
  | "attachment_ingestion";

export type OfficialEstimateIntakeResult = {
  leadId: string;
  replay: boolean;
  reviewStatus: "pending_review" | "routed";
  blockers: IntakeBlocker[];
  recipients?: number;
};

export class LeadIntakeConflictError extends Error {
  readonly code = "LEAD_INTAKE_IDEMPOTENCY_CONFLICT";

  constructor() {
    super("The external request ID was already used with a different payload.");
    this.name = "LeadIntakeConflictError";
  }
}

/** Blocker codes stored on Lead.reviewBlocker (shown to admins). */
export const HOLD_REASONS = {
  ...REVIEW_BLOCKERS,
  NO_ELIGIBLE_CONTRACTORS: "NO_ELIGIBLE_CONTRACTORS",
  DIRECT_CONTRACTOR_NOT_FOUND: "DIRECT_CONTRACTOR_NOT_FOUND",
  ROUTING_ERROR: "ROUTING_ERROR",
} as const;

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function runAfterResponse(task: () => Promise<unknown>, label: string) {
  const run = async () => {
    try {
      await task();
    } catch (error) {
      console.error(`[lead-intake] ${label} failed`, error);
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/** Legacy admin/manual path with explicit tier (historical land projects). */
export async function createAndDistributeLead(
  input: LeadIntakeInput,
): Promise<LeadIntakeResult> {
  const projectType = await prisma.projectType.findFirst({
    where: { id: input.projectTypeId, archivedAt: null },
    select: { id: true, name: true, contractorTypeId: true },
  });
  if (!projectType) throw new NotFoundError("Active project type");

  if (input.landTypeId) {
    const landType = await prisma.landType.findFirst({
      where: { id: input.landTypeId, archivedAt: null },
      select: { id: true },
    });
    if (!landType) throw new NotFoundError("Active land type");
  }

  const priceCents = await resolvePrice(prisma, {
    contractorTypeId: projectType.contractorTypeId,
    projectTypeId: projectType.id,
    tier: input.tier,
  });
  const [expiryHours, maxPurchases] = await Promise.all([
    getLeadExpiryHours(prisma),
    getMaxLeadPurchases(prisma),
  ]);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours * 3600 * 1000);

  const lead = await prisma.lead.create({
    data: {
      landownerName: input.landownerName,
      landownerEmail: input.landownerEmail,
      landownerPhone: input.landownerPhone,
      propertyLocation: input.propertyLocation,
      description: clean(input.description),
      projectTypeId: projectType.id,
      landTypeId: input.landTypeId ?? null,
      budgetCents: input.budgetCents ?? null,
      tier: input.tier,
      priceCents,
      maxPurchases,
      status: LeadStatus.NEW,
      reviewStatus: LeadReviewStatus.ROUTED,
      tierReviewRequired: false,
      budgetReviewRequired: false,
      contractorReviewRequired: false,
      routingMode: LeadRoutingMode.GENERAL,
      routedAt: now,
      source: input.source ?? "wix_form",
      expiresAt,
    },
  });

  const { matches } = await distributeLead(prisma, lead.id);
  await notifyContractorsOfNewLead(lead.id, matches.map((m) => m.id));
  await writeLeadAudit("LEAD_CREATED", lead.id, {
    source: lead.source,
    recipients: matches.length,
    priceCents,
    compatibilityPath: true,
  });

  return { leadId: lead.id, priceCents, recipients: matches.length };
}

export async function createOfficialEstimateRequest(
  input: OfficialEstimateIntakeInput,
): Promise<OfficialEstimateIntakeResult> {
  if (input.externalRequestId && !input.payloadHash) {
    throw new InvalidStateError("A payload hash is required with an external request ID.");
  }

  // Idempotency first: a retried webhook must not create taxonomy or rows.
  if (input.externalRequestId) {
    const existing = await findByExternalRequest(input.source, input.externalRequestId);
    if (existing) return replayResult(existing, input.payloadHash);
  }

  const taxonomy = resolveTaxonomyInputs({
    contractorCategoryCode: input.contractorCategoryCode,
    landTypeCode: input.landTypeCode,
    projectTypeCode: input.projectTypeCode,
    timeline: input.timelineRaw ?? input.timeline?.toISOString().slice(0, 10) ?? "",
    urgency: input.urgency ?? "",
    budget: input.budget,
    budgetBand: input.budgetBand,
  });

  const [category, workType, landType] = await Promise.all([
    ensureCategory(prisma, input.contractorCategoryCode),
    ensureWorkType(prisma, input.projectTypeCode),
    ensureLandType(prisma, input.landTypeCode),
  ]);

  const budget = resolveLeadBudget({
    budgetCents: input.budgetCents,
    budget: input.budget,
    budgetBand: taxonomy.budgetBand,
  });
  const budgetCents = budget.ok && budget.kind === "exact" ? budget.budgetCents : null;
  const budgetBand: BudgetBand | null =
    budget.ok && budget.kind === "band"
      ? budget.budgetBand
      : budgetCents != null
        ? inferBudgetBandFromCents(budgetCents)
        : taxonomy.budgetBand;

  const isDirect = input.routing.mode === "direct";
  let directExternalId: string | null = null;
  if (input.routing.mode === "direct") {
    const resolved = await resolveWixContractorExternalId(prisma, input.routing.contractorExternalId);
    directExternalId = resolved.externalId;
    await ensureDirectContractorSynced(input.routing.contractorSource, directExternalId);
  }

  const firstName = clean(input.firstName);
  const lastName = clean(input.lastName);
  const leadData: Prisma.LeadCreateInput = {
    landownerName: clean([firstName, lastName].filter(Boolean).join(" ")),
    firstName,
    lastName,
    landownerEmail: input.email.trim().toLowerCase(),
    landownerPhone: clean(input.phone),
    propertyLocation: input.propertyZip.trim(),
    propertyZip: input.propertyZip.trim(),
    contractorCategory: category ? { connect: { id: category.id } } : undefined,
    landType: landType ? { connect: { id: landType.id } } : undefined,
    workType: workType ? { connect: { id: workType.id } } : undefined,
    description: clean(input.description),
    budget: clean(input.budget) ?? (budget.ok ? budget.budgetRaw : null),
    budgetCents,
    budgetBand,
    timeline: taxonomy.timelineDate ?? input.timeline ?? null,
    timelineCode: taxonomy.timelineCode,
    timelineRaw: taxonomy.timelineRaw || null,
    urgency: taxonomy.urgencyRaw || null,
    urgencyCode: taxonomy.urgencyCode,
    tier: null,
    priceCents: null,
    maxPurchases: isDirect ? 1 : await getMaxLeadPurchases(prisma),
    status: LeadStatus.NEW,
    reviewStatus: LeadReviewStatus.PENDING_REVIEW,
    tierReviewRequired: false,
    budgetReviewRequired: false,
    pricingReviewRequired: false,
    contractorReviewRequired: false,
    routingMode: isDirect ? LeadRoutingMode.DIRECT : LeadRoutingMode.GENERAL,
    directContractorSource: input.routing.mode === "direct" ? input.routing.contractorSource : null,
    directContractorExternalId: directExternalId,
    source: input.source,
    externalRequestId: input.externalRequestId ?? null,
    payloadHash: input.payloadHash ?? null,
    expiresAt: null,
  };

  let leadId: string;
  try {
    const lead = await prisma.lead.create({ data: leadData, select: { id: true } });
    leadId = lead.id;
  } catch (error) {
    if (input.externalRequestId && isUniqueConstraint(error)) {
      const existing = await findByExternalRequest(input.source, input.externalRequestId);
      if (existing) return replayResult(existing, input.payloadHash);
    }
    throw error;
  }

  await writeLeadAudit("lead.request.created", leadId, {
    source: input.source,
    externalRequestId: input.externalRequestId ?? null,
    routingMode: input.routing.mode,
    category: category?.code ?? null,
    categoryCreated: category?.created ?? false,
    workType: workType?.code ?? null,
    workTypeCreated: workType?.created ?? false,
    landType: landType?.code ?? null,
    budgetRaw: input.budget ?? null,
    budgetCents,
    budgetBand,
    budgetUnderstood: budget.ok,
    attachments: input.attachments?.length ?? 0,
  });

  // Photos are downloaded after the response so Wix never waits on them, and a
  // broken photo URL can never block a lead.
  const attachments = input.attachments ?? [];
  if (attachments.length > 0) {
    runAfterResponse(
      () => ingestLeadAttachments({ leadId, attachments }),
      "attachment ingestion",
    );
  }

  const routed = await routeLeadSafely({ leadId, actorId: null, expectedPhotos: attachments.length });
  return {
    leadId,
    replay: false,
    reviewStatus: routed.heldForReview ? "pending_review" : "routed",
    blockers: routed.blockers,
    recipients: routed.recipients,
  };
}

/** If a direct request names a contractor we have not synced yet, fetch it from Wix now. */
async function ensureDirectContractorSynced(source: string, externalId: string) {
  const identity = await prisma.externalContractorIdentity.findUnique({
    where: { source_externalId: { source, externalId } },
    select: { id: true },
  });
  if (identity || source !== "wix") return;
  try {
    const { syncWixContractorById } = await import("@/lib/integrations/wix/contractor-sync");
    await syncWixContractorById(externalId);
  } catch (error) {
    console.error("[lead-intake] on-demand Wix contractor sync failed", { externalId, error });
  }
}

export async function finalizeLeadForRouting(params: {
  leadId: string;
  budgetCents?: number;
  actorId?: string | null;
}): Promise<LeadIntakeResult & { heldForContractorReview: boolean; heldForReview?: boolean; blockers: IntakeBlocker[] }> {
  if (params.budgetCents != null) {
    if (!Number.isInteger(params.budgetCents) || params.budgetCents <= 0) {
      throw new InvalidStateError("Budget must be a positive whole number of cents.");
    }
    await prisma.lead.update({
      where: { id: params.leadId },
      data: {
        budgetCents: params.budgetCents,
        budgetBand: inferBudgetBandFromCents(params.budgetCents),
        budgetReviewRequired: false,
        tierReviewRequired: false,
      },
    });
  }
  const routed = await autoRouteLead(params);
  return {
    ...routed,
    heldForContractorReview: routed.heldForReview,
  };
}

type AutoRouteResult = LeadIntakeResult & {
  heldForReview: boolean;
  blockers: IntakeBlocker[];
};

/** Best-effort display tier (1-3). Never blocks routing in the success-fee model. */
async function displayTier(
  tx: DbClient,
  lead: { tier: number | null; workTypeId: string | null; budgetBand: BudgetBand | null; budgetCents: number | null },
): Promise<number | null> {
  if (lead.tier) return lead.tier;
  const band = lead.budgetBand ?? (lead.budgetCents ? inferBudgetBandFromCents(lead.budgetCents) : null);
  if (!band) return null;
  if (lead.workTypeId) {
    try {
      const mapped = await resolveTierForBudgetBand(tx, { workTypeId: lead.workTypeId, budgetBand: band });
      if (mapped.ok) return mapped.tier;
    } catch {
      // Display-only value: a missing mapping table or row must never block routing.
    }
  }
  return band === "UNDER_5K" ? 1 : band === "BETWEEN_5K_15K" ? 2 : 3;
}

function blockerForReason(reason: string | null): IntakeBlocker[] {
  switch (reason) {
    case HOLD_REASONS.NO_ELIGIBLE_CONTRACTORS:
      return ["no_matching_contractor"];
    case HOLD_REASONS.DIRECT_CONTRACTOR_NOT_FOUND:
      return ["contractor_review"];
    case HOLD_REASONS.MISSING_CONTRACTOR_CATEGORY:
    case HOLD_REASONS.OTHER_CATEGORY_CLASSIFICATION_REQUIRED:
      return ["category_review"];
    case HOLD_REASONS.ROUTING_ERROR:
      return ["routing_error"];
    default:
      return [];
  }
}

const HOLD_REASON_TEXT: Record<string, string> = {
  [HOLD_REASONS.NO_ELIGIBLE_CONTRACTORS]:
    "No active contractor in this category covers the property's area.",
  [HOLD_REASONS.DIRECT_CONTRACTOR_NOT_FOUND]:
    "The homeowner asked for a specific contractor that is unknown or deactivated in Landy's Pro.",
  [HOLD_REASONS.MISSING_CONTRACTOR_CATEGORY]: "The request has no contractor category.",
  [HOLD_REASONS.OTHER_CATEGORY_CLASSIFICATION_REQUIRED]:
    "The request is in the \"Other\" category and no contractor covers it.",
  [HOLD_REASONS.ROUTING_ERROR]: "Routing failed unexpectedly.",
};

/** Route, and turn any unexpected failure into a held lead + admin alert (never an error for Wix). */
async function routeLeadSafely(params: {
  leadId: string;
  actorId?: string | null;
  expectedPhotos?: number;
}): Promise<AutoRouteResult> {
  try {
    return await autoRouteLead(params);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[lead-intake] routing failed", { leadId: params.leadId, error });
    await prisma.lead
      .update({
        where: { id: params.leadId },
        data: {
          reviewStatus: LeadReviewStatus.PENDING_REVIEW,
          reviewBlocker: HOLD_REASONS.ROUTING_ERROR,
          expiresAt: null,
        },
      })
      .catch(() => undefined);
    await writeLeadAudit("lead.routing.failed", params.leadId, {
      error: message.slice(0, 500),
      domainError: error instanceof DomainError,
    }).catch(() => undefined);
    await notifyAdmins({
      kind: "lead_held",
      title: "A new request could not be sent to contractors",
      lines: [
        "A request from landys.co was saved but routing failed. Please review it and route it manually.",
        `Error: ${message.slice(0, 300)}`,
      ],
      link: { label: "Open the request", path: `/admin/leads/${params.leadId}` },
      leadId: params.leadId,
    });
    return {
      leadId: params.leadId,
      priceCents: 0,
      recipients: 0,
      heldForReview: true,
      blockers: ["routing_error"],
    };
  }
}

async function autoRouteLead(params: {
  leadId: string;
  actorId?: string | null;
  expectedPhotos?: number;
}): Promise<AutoRouteResult> {
  const result = await prisma.$transaction(
    async (tx) => {
      const lead = await tx.lead.findUnique({
        where: { id: params.leadId },
        include: { contractorCategory: true, matches: true },
      });
      if (!lead) throw new NotFoundError("Lead");

      if (lead.reviewStatus === LeadReviewStatus.ROUTED) {
        return {
          lead,
          matchIds: [] as string[],
          recipients: lead.matches.length,
          heldReason: null as string | null,
          usedFallback: false,
        };
      }

      const tier = await displayTier(tx, lead);
      const hold = async (reason: string, extra: Prisma.LeadUpdateInput = {}) => {
        const held = await tx.lead.update({
          where: { id: lead.id },
          data: {
            tier,
            reviewBlocker: reason,
            reviewStatus: LeadReviewStatus.PENDING_REVIEW,
            expiresAt: null,
            ...extra,
          },
          include: { contractorCategory: true, matches: true },
        });
        return { lead: held, matchIds: [] as string[], recipients: 0, heldReason: reason, usedFallback: false };
      };

      const expiryHours = await getLeadExpiryHours(tx);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiryHours * 3600 * 1000);

      if (lead.routingMode === LeadRoutingMode.DIRECT && lead.directContractorSource && lead.directContractorExternalId) {
        const identity = await tx.externalContractorIdentity.findUnique({
          where: {
            source_externalId: {
              source: lead.directContractorSource,
              externalId: lead.directContractorExternalId,
            },
          },
          select: { contractor: { select: { id: true, deactivatedAt: true } } },
        });
        if (!identity || identity.contractor.deactivatedAt) {
          return hold(HOLD_REASONS.DIRECT_CONTRACTOR_NOT_FOUND, { contractorReviewRequired: true, maxPurchases: 1 });
        }
        const match = await tx.leadMatch.upsert({
          where: { leadId_contractorId: { leadId: lead.id, contractorId: identity.contractor.id } },
          update: {},
          create: {
            leadId: lead.id,
            contractorId: identity.contractor.id,
            status: LeadMatchStatus.PENDING,
            acceptToken: generateAcceptToken(),
          },
          select: { id: true },
        });
        const routed = await tx.lead.update({
          where: { id: lead.id },
          data: {
            tier,
            tierReviewRequired: false,
            budgetReviewRequired: false,
            pricingReviewRequired: false,
            contractorReviewRequired: false,
            reviewBlocker: null,
            reviewStatus: LeadReviewStatus.ROUTED,
            status: LeadStatus.DISTRIBUTED,
            maxPurchases: 1,
            routedAt: now,
            expiresAt,
          },
          include: { contractorCategory: true, matches: true },
        });
        return { lead: routed, matchIds: [match.id], recipients: 1, heldReason: null, usedFallback: false };
      }

      if (!lead.contractorCategoryId && !lead.projectTypeId) {
        return hold(HOLD_REASONS.MISSING_CONTRACTOR_CATEGORY);
      }

      const maxPurchases = lead.maxPurchases > 0 ? lead.maxPurchases : await getMaxLeadPurchases(tx);
      await tx.lead.update({
        where: { id: lead.id },
        data: {
          tier,
          tierReviewRequired: false,
          budgetReviewRequired: false,
          pricingReviewRequired: false,
          contractorReviewRequired: false,
          reviewBlocker: null,
          reviewStatus: LeadReviewStatus.READY,
          maxPurchases,
          expiresAt,
        },
      });
      const distributed = await distributeLead(tx, lead.id);
      if (distributed.matches.length === 0 && lead.matches.length === 0) {
        return hold(
          lead.contractorCategory?.code === "other"
            ? HOLD_REASONS.OTHER_CATEGORY_CLASSIFICATION_REQUIRED
            : HOLD_REASONS.NO_ELIGIBLE_CONTRACTORS,
        );
      }
      const routed = await tx.lead.update({
        where: { id: lead.id },
        data: { reviewStatus: LeadReviewStatus.ROUTED, routedAt: now },
        include: { contractorCategory: true, matches: true },
      });
      return {
        lead: routed,
        matchIds: distributed.matches.map((m) => m.id),
        recipients: distributed.matches.length,
        heldReason: null,
        usedFallback: distributed.usedFallback,
      };
    },
    { maxWait: 20_000, timeout: 60_000 },
  );

  const heldForReview = result.heldReason !== null;
  if (heldForReview) {
    await notifyAdmins({
      kind: "lead_held",
      title: "A new request needs your review",
      lines: [
        HOLD_REASON_TEXT[result.heldReason!] ?? "The request could not be routed automatically.",
        `Category: ${result.lead.contractorCategory?.name ?? "none"} - ZIP ${result.lead.propertyZip ?? result.lead.propertyLocation}.`,
        "Nobody has been contacted yet. Open the request to assign it.",
      ],
      link: { label: "Review the request", path: `/admin/leads/${result.lead.id}` },
      leadId: result.lead.id,
    });
  } else if (result.matchIds.length > 0) {
    await notifyContractorsOfNewLead(result.lead.id, result.matchIds, {
      photoCount: params.expectedPhotos,
    });
  }

  await writeLeadAudit("lead.routing.finalized", result.lead.id, {
    recipients: result.recipients,
    tier: result.lead.tier,
    heldForReview,
    reviewBlocker: result.heldReason,
    usedNoAreaFallback: result.usedFallback,
    actorId: params.actorId ?? null,
  });

  return {
    leadId: result.lead.id,
    priceCents: result.lead.priceCents ?? 0,
    recipients: result.recipients,
    heldForReview,
    blockers: blockerForReason(result.heldReason),
  };
}

export async function reclassifyLeadCategory(params: {
  leadId: string;
  contractorCategoryId: string;
  actorId?: string | null;
}): Promise<AutoRouteResult> {
  const category = await prisma.contractorCategory.findFirst({
    where: {
      id: params.contractorCategoryId,
      archivedAt: null,
      code: { not: "other" },
    },
    select: { id: true },
  });
  if (!category) {
    throw new InvalidStateError("Choose an active non-Other contractor category.");
  }

  await prisma.lead.update({
    where: { id: params.leadId },
    data: {
      contractorCategoryId: category.id,
      reviewBlocker: null,
      contractorReviewRequired: false,
    },
  });
  return autoRouteLead({ leadId: params.leadId, actorId: params.actorId });
}

async function findByExternalRequest(source: string, externalRequestId: string) {
  const lead = await prisma.lead.findUnique({
    where: { source_externalRequestId: { source, externalRequestId } },
    select: {
      id: true,
      payloadHash: true,
      reviewStatus: true,
      reviewBlocker: true,
      contractorReviewRequired: true,
    },
  });
  if (!lead) return null;
  const matches = await prisma.leadMatch.findMany({ where: { leadId: lead.id }, select: { id: true } });
  return { ...lead, matchCount: matches.length };
}

function replayResult(
  existing: NonNullable<Awaited<ReturnType<typeof findByExternalRequest>>>,
  payloadHash: string | null | undefined,
): OfficialEstimateIntakeResult {
  if (existing.payloadHash !== payloadHash) throw new LeadIntakeConflictError();
  const blockers = blockerForReason(existing.reviewBlocker);
  if (existing.contractorReviewRequired && !blockers.includes("contractor_review")) {
    blockers.push("contractor_review");
  }
  return {
    leadId: existing.id,
    replay: true,
    reviewStatus: existing.reviewStatus === LeadReviewStatus.ROUTED ? "routed" : "pending_review",
    blockers,
    recipients: existing.matchCount,
  };
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function writeLeadAudit(
  action: string,
  leadId: string,
  metadata: Prisma.InputJsonObject,
) {
  await prisma.auditLog.create({
    data: {
      actorType: "system",
      action,
      targetType: "Lead",
      targetId: leadId,
      metadata,
    },
  });
}

/** Re-run automatic routing for a held lead (e.g. after adding a contractor). */
export async function retryLeadRouting(params: { leadId: string; actorId: string | null }) {
  await prisma.lead.update({
    where: { id: params.leadId },
    data: { reviewBlocker: null, contractorReviewRequired: false },
  });
  return routeLeadSafely({ leadId: params.leadId, actorId: params.actorId });
}

/** Admin sends a lead to hand-picked contractors (bypasses category / area matching). */
export async function assignLeadToContractors(params: {
  leadId: string;
  contractorIds: string[];
  actorId: string | null;
}): Promise<{ recipients: number }> {
  const ids = [...new Set(params.contractorIds)];
  if (ids.length === 0) throw new InvalidStateError("Choose at least one contractor.");
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({ where: { id: params.leadId }, include: { matches: true } });
    if (!lead) throw new NotFoundError("Lead");
    if (lead.status === LeadStatus.EXPIRED || lead.status === LeadStatus.CLOSED) {
      throw new InvalidStateError("This request is closed.");
    }
    const contractors = await tx.contractor.findMany({
      where: { id: { in: ids }, deactivatedAt: null },
      select: { id: true },
    });
    const already = new Set(lead.matches.map((m) => m.contractorId));
    const now = new Date();
    const expiresAt =
      lead.expiresAt && lead.expiresAt > now
        ? lead.expiresAt
        : new Date(now.getTime() + (await getLeadExpiryHours(tx)) * 3600 * 1000);
    const created: string[] = [];
    for (const contractor of contractors) {
      if (already.has(contractor.id)) continue;
      const match = await tx.leadMatch.create({
        data: {
          leadId: lead.id,
          contractorId: contractor.id,
          status: LeadMatchStatus.PENDING,
          acceptToken: generateAcceptToken(),
        },
        select: { id: true },
      });
      created.push(match.id);
    }
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        reviewStatus: LeadReviewStatus.ROUTED,
        reviewBlocker: null,
        contractorReviewRequired: false,
        status: lead.status === LeadStatus.SOLD_OUT ? lead.status : LeadStatus.DISTRIBUTED,
        routedAt: lead.routedAt ?? now,
        expiresAt,
      },
    });
    await tx.auditLog.create({
      data: {
        actorType: "admin",
        actorId: params.actorId,
        action: "lead.assigned.manual",
        targetType: "Lead",
        targetId: lead.id,
        metadata: { contractorIds: ids, created: created.length },
      },
    });
    return created;
  });
  await notifyContractorsOfNewLead(params.leadId, result);
  return { recipients: result.length };
}
