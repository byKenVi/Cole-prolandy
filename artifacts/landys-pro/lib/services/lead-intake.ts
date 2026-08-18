import {
  LeadMatchStatus,
  LeadReviewStatus,
  LeadRoutingMode,
  LeadStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { distributeLead } from "@/lib/domain/leads";
import { resolveLeadBudget } from "@/lib/domain/budget";
import {
  snapshotLeadPricing,
  snapshotLiveLeadPricing,
  snapshotLiveLeadPricingFromExactBudget,
} from "@/lib/domain/tier-resolution";
import { REVIEW_BLOCKERS } from "@/lib/taxonomy/live-v3";
import {
  resolveTaxonomyInputs,
  type ResolvedLiveTaxonomies,
} from "@/lib/services/live-taxonomy-resolution";
import { resolvePrice } from "@/lib/domain/pricing";
import { getLeadExpiryHours, getMaxLeadPurchases } from "@/lib/domain/settings";
import { InvalidStateError, NotFoundError } from "@/lib/domain/errors";
import type { DbClient } from "@/lib/domain/types";
import { notifyNewLead } from "@/lib/notifications";
import { generateAcceptToken } from "@/lib/tokens";
import type { WixEstimateAttachment } from "@/lib/integrations/wix/estimate-contract";
import { ingestLeadAttachments } from "@/lib/services/lead-attachments";
import { resolveWixContractorExternalId } from "@/lib/integrations/wix/contractor-id-resolver";

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

export type OfficialEstimateIntakeResult = {
  leadId: string;
  replay: boolean;
  reviewStatus: "pending_review" | "routed";
  blockers: Array<
    | "budget_review"
    | "pricing_review"
    | "contractor_review"
    | "category_review"
    | "attachment_ingestion"
  >;
};

export class LeadIntakeConflictError extends Error {
  readonly code = "LEAD_INTAKE_IDEMPOTENCY_CONFLICT";

  constructor() {
    super("The external request ID was already used with a different payload.");
    this.name = "LeadIntakeConflictError";
  }
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Legacy admin/manual path with explicit tier. */
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
  await notifyMatches(matches, {
    leadId: lead.id,
    projectTypeName: projectType.name,
    propertyLocation: lead.propertyLocation,
    tier: input.tier,
    priceCents,
  });
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

  const taxonomy = resolveTaxonomyInputs({
    contractorCategoryCode: input.contractorCategoryCode,
    landTypeCode: input.landTypeCode,
    projectTypeCode: input.projectTypeCode,
    timeline: input.timelineRaw ?? input.timeline?.toISOString().slice(0, 10) ?? "",
    urgency: input.urgency ?? "",
    budget: input.budget,
    budgetBand: input.budgetBand,
  });

  const resolved = await resolveIntakeTaxonomyIds(taxonomy, input);
  if (!resolved.landType) throw new NotFoundError("Active land type");
  if (taxonomy.intakeMode === "legacy" && !resolved.projectType) {
    throw new NotFoundError("Active project type");
  }
  if (taxonomy.intakeMode === "live" && !resolved.workType) {
    throw new NotFoundError("Active work type");
  }
  if (input.contractorCategoryCode && !resolved.category) {
    throw new NotFoundError("Active contractor category");
  }

  if (input.externalRequestId) {
    const existing = await prisma.lead.findUnique({
      where: {
        source_externalRequestId: {
          source: input.source,
          externalRequestId: input.externalRequestId,
        },
      },
      select: {
        id: true,
        payloadHash: true,
        reviewStatus: true,
        tierReviewRequired: true,
        budgetReviewRequired: true,
        pricingReviewRequired: true,
        contractorReviewRequired: true,
      },
    });
    if (existing) return replayResult(existing, input.payloadHash);
  }

  const budgetResolution = resolveLeadBudget({
    budgetCents: input.budgetCents,
    budget: input.budget,
    budgetBand: taxonomy.budgetBand,
  });
  const budgetReviewRequired = !budgetResolution.ok;

  let contractorReviewRequired = false;
  let resolvedExternalId =
    input.routing.mode === "direct" ? input.routing.contractorExternalId : null;
  if (input.routing.mode === "direct") {
    const resolvedContractor = await resolveWixContractorExternalId(
      prisma,
      input.routing.contractorExternalId,
    );
    resolvedExternalId = resolvedContractor.externalId;
    const identity = await prisma.externalContractorIdentity.findUnique({
      where: {
        source_externalId: {
          source: input.routing.contractorSource,
          externalId: resolvedExternalId,
        },
      },
      select: { contractor: { select: { deactivatedAt: true } } },
    });
    contractorReviewRequired = !identity || Boolean(identity.contractor.deactivatedAt);
  }

  const isDirect = input.routing.mode === "direct";
  const maxPurchasesDefault = isDirect ? 1 : await getMaxLeadPurchases(prisma);
  const categoryReviewRequired =
    !isDirect &&
    taxonomy.intakeMode === "live" &&
    (!resolved.category || !taxonomy.categoryCode);

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
    contractorCategory: resolved.category ? { connect: { id: resolved.category.id } } : undefined,
    landType: { connect: { id: resolved.landType.id } },
    projectType: resolved.projectType ? { connect: { id: resolved.projectType.id } } : undefined,
    workType: resolved.workType ? { connect: { id: resolved.workType.id } } : undefined,
    description: clean(input.description),
    budget: budgetResolution.ok ? budgetResolution.budgetRaw : clean(input.budget),
    budgetCents:
      budgetResolution.ok && budgetResolution.kind === "exact"
        ? budgetResolution.budgetCents
        : null,
    budgetBand:
      budgetResolution.ok && budgetResolution.kind === "band"
        ? budgetResolution.budgetBand
        : taxonomy.budgetBand,
    timeline: taxonomy.timelineDate ?? input.timeline ?? null,
    timelineCode: taxonomy.timelineCode,
    timelineRaw: taxonomy.timelineRaw,
    urgency: taxonomy.urgencyRaw,
    urgencyCode: taxonomy.urgencyCode,
    tier: null,
    priceCents: null,
    maxPurchases: maxPurchasesDefault,
    status: LeadStatus.NEW,
    reviewStatus: LeadReviewStatus.PENDING_REVIEW,
    tierReviewRequired: budgetReviewRequired,
    budgetReviewRequired,
    pricingReviewRequired: false,
    contractorReviewRequired,
    reviewBlocker: categoryReviewRequired
      ? REVIEW_BLOCKERS.MISSING_CONTRACTOR_CATEGORY
      : null,
    routingMode: isDirect ? LeadRoutingMode.DIRECT : LeadRoutingMode.GENERAL,
    directContractorSource:
      input.routing.mode === "direct" ? input.routing.contractorSource : null,
    directContractorExternalId: isDirect ? resolvedExternalId : null,
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
      const existing = await prisma.lead.findUnique({
        where: {
          source_externalRequestId: {
            source: input.source,
            externalRequestId: input.externalRequestId,
          },
        },
        select: {
          id: true,
          payloadHash: true,
          reviewStatus: true,
          tierReviewRequired: true,
          budgetReviewRequired: true,
          pricingReviewRequired: true,
          contractorReviewRequired: true,
        },
      });
      if (existing) return replayResult(existing, input.payloadHash);
    }
    throw error;
  }

  const attachmentResult = await ingestLeadAttachments({
    leadId,
    attachments: input.attachments ?? [],
  });

  const blockers: OfficialEstimateIntakeResult["blockers"] = [];
  if (budgetReviewRequired) blockers.push("budget_review");
  if (categoryReviewRequired) blockers.push("category_review");
  if (contractorReviewRequired) blockers.push("contractor_review");
  if (attachmentResult.hasFailures) blockers.push("attachment_ingestion");

  await writeLeadAudit("lead.request.created", leadId, {
    source: input.source,
    externalRequestId: input.externalRequestId ?? null,
    routingMode: input.routing.mode,
    blockers,
    intakeMode: taxonomy.intakeMode,
    budgetCents:
      budgetResolution.ok && budgetResolution.kind === "exact"
        ? budgetResolution.budgetCents
        : null,
    budgetBand:
      budgetResolution.ok && budgetResolution.kind === "band"
        ? budgetResolution.budgetBand
        : taxonomy.budgetBand,
  });

  const canAutoRoute =
    !budgetReviewRequired &&
    !contractorReviewRequired &&
    !categoryReviewRequired &&
    !attachmentResult.hasFailures;

  if (canAutoRoute) {
    const routed = await autoRouteLead({ leadId, actorId: null });
    return {
      leadId,
      replay: false,
      reviewStatus: routed.heldForReview ? "pending_review" : "routed",
      blockers: routed.blockers.length > 0 ? [...blockers, ...routed.blockers] : blockers,
    };
  }

  return {
    leadId,
    replay: false,
    reviewStatus: "pending_review",
    blockers,
  };
}

async function resolveIntakeTaxonomyIds(
  taxonomy: ResolvedLiveTaxonomies,
  input: OfficialEstimateIntakeInput,
) {
  const categoryCode = taxonomy.categoryCode ?? input.contractorCategoryCode?.trim().toLowerCase();
  const [workType, projectType, landType, category] = await Promise.all([
    taxonomy.workTypeCode
      ? prisma.workType.findFirst({
          where: {
            code: taxonomy.workTypeCode,
            archivedAt: null,
            isActiveForNewIntake: true,
          },
          select: { id: true, name: true },
        })
      : null,
    taxonomy.legacyProjectTypeCode
      ? prisma.projectType.findFirst({
          where: { code: taxonomy.legacyProjectTypeCode, archivedAt: null },
          select: { id: true, contractorTypeId: true, name: true },
        })
      : null,
    prisma.landType.findFirst({
      where: {
        code: taxonomy.landTypeCode ?? input.landTypeCode.trim().toLowerCase(),
        archivedAt: null,
        ...(taxonomy.intakeMode === "live" ? { isActiveForNewIntake: true } : {}),
      },
      select: { id: true },
    }),
    categoryCode
      ? prisma.contractorCategory.findFirst({
          where: {
            code: categoryCode,
            archivedAt: null,
            ...(taxonomy.intakeMode === "live" ? { isActiveForNewIntake: true } : {}),
          },
          select: { id: true, code: true },
        })
      : null,
  ]);
  return { workType, projectType, landType, category };
}

export async function finalizeLeadForRouting(params: {
  leadId: string;
  budgetCents?: number;
  actorId?: string | null;
}): Promise<LeadIntakeResult & { heldForContractorReview: boolean; heldForReview?: boolean }> {
  if (params.budgetCents != null) {
    if (!Number.isInteger(params.budgetCents) || params.budgetCents <= 0) {
      throw new InvalidStateError("Budget must be a positive whole number of cents.");
    }
    await prisma.lead.update({
      where: { id: params.leadId },
      data: {
        budgetCents: params.budgetCents,
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
  blockers: OfficialEstimateIntakeResult["blockers"];
};

async function resolveLeadPricingSnapshot(
  tx: DbClient,
  lead: {
    workTypeId: string | null;
    projectTypeId: string | null;
    budgetCents: number | null;
    budgetBand: import("@prisma/client").BudgetBand | null;
    projectType: { contractorTypeId: string } | null;
  },
): Promise<{ tier: 1 | 2 | 3; priceCents: number; pricingRequired: boolean }> {
  if (lead.workTypeId) {
    if (lead.budgetBand) {
      return snapshotLiveLeadPricing(tx, {
        workTypeId: lead.workTypeId,
        budgetBand: lead.budgetBand,
      });
    }
    if (lead.budgetCents != null) {
      return snapshotLiveLeadPricingFromExactBudget(tx, {
        workTypeId: lead.workTypeId,
        budgetCents: lead.budgetCents,
      });
    }
    throw new InvalidStateError("This lead requires budget review before routing.");
  }

  if (!lead.projectType || lead.projectTypeId == null || lead.budgetCents == null) {
    throw new InvalidStateError("This lead requires budget review before routing.");
  }

  const pricing = await snapshotLeadPricing(tx, {
    contractorTypeId: lead.projectType.contractorTypeId,
    projectTypeId: lead.projectTypeId,
    budgetCents: lead.budgetCents,
  });
  return { ...pricing, pricingRequired: pricing.priceCents <= 0 };
}

async function autoRouteLead(params: {
  leadId: string;
  actorId?: string | null;
}): Promise<AutoRouteResult> {
  const blockers: OfficialEstimateIntakeResult["blockers"] = [];
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: params.leadId },
      include: {
        projectType: true,
        workType: true,
        contractorCategory: true,
        matches: true,
      },
    });
    if (!lead) throw new NotFoundError("Lead");

    if (lead.reviewStatus === LeadReviewStatus.ROUTED) {
      if (lead.priceCents === null) {
        throw new InvalidStateError("A routed lead is missing its price snapshot.");
      }
      return {
        lead,
        matches: [],
        recipients: lead.matches.length,
        heldForReview: false,
      };
    }

    const budgetReady =
      lead.workTypeId != null
        ? !lead.budgetReviewRequired && (lead.budgetBand != null || lead.budgetCents != null)
        : lead.budgetCents != null && !lead.budgetReviewRequired;
    if (!budgetReady) {
      throw new InvalidStateError("This lead requires budget review before routing.");
    }

    const pricing = await resolveLeadPricingSnapshot(tx, lead);
    const priceCents = lead.priceCents ?? pricing.priceCents;
    const tier = lead.tier ?? pricing.tier;
    const pricingRequired = pricing.pricingRequired || priceCents <= 0;

    if (pricingRequired) {
      const held = await tx.lead.update({
        where: { id: lead.id },
        data: {
          tier,
          priceCents: priceCents > 0 ? priceCents : null,
          tierReviewRequired: false,
          budgetReviewRequired: false,
          pricingReviewRequired: true,
          reviewBlocker: REVIEW_BLOCKERS.PRICING_REQUIRED,
          reviewStatus: LeadReviewStatus.PENDING_REVIEW,
          expiresAt: null,
        },
        include: { projectType: true, workType: true },
      });
      return { lead: held, matches: [], recipients: 0, heldForReview: true };
    }

    if (
      lead.routingMode === LeadRoutingMode.DIRECT &&
      lead.directContractorSource &&
      lead.directContractorExternalId
    ) {
      const identity = await tx.externalContractorIdentity.findUnique({
        where: {
          source_externalId: {
            source: lead.directContractorSource,
            externalId: lead.directContractorExternalId,
          },
        },
        select: {
          contractor: {
            select: { id: true, name: true, email: true, phone: true, deactivatedAt: true },
          },
        },
      });
      if (!identity || identity.contractor.deactivatedAt) {
        const held = await tx.lead.update({
          where: { id: lead.id },
          data: {
            tier,
            priceCents,
            tierReviewRequired: false,
            budgetReviewRequired: false,
            pricingReviewRequired: false,
            contractorReviewRequired: true,
            reviewStatus: LeadReviewStatus.PENDING_REVIEW,
            maxPurchases: 1,
            expiresAt: null,
          },
          include: { projectType: true, workType: true },
        });
        await tx.auditLog.create({
          data: {
            actorType: "admin",
            actorId: params.actorId ?? null,
            action: "lead.routing.held",
            targetType: "Lead",
            targetId: lead.id,
            metadata: { reason: "direct_contractor_unresolved", priceCents },
          },
        });
        return { lead: held, matches: [], recipients: 0, heldForReview: true };
      }

      const expiryHours = await getLeadExpiryHours(tx);
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expiryHours * 3600 * 1000);
      const match = await tx.leadMatch.upsert({
        where: {
          leadId_contractorId: {
            leadId: lead.id,
            contractorId: identity.contractor.id,
          },
        },
        update: {},
        create: {
          leadId: lead.id,
          contractorId: identity.contractor.id,
          status: LeadMatchStatus.PENDING,
          acceptToken: generateAcceptToken(),
        },
        select: { id: true, contractorId: true, acceptToken: true },
      });
      const routed = await tx.lead.update({
        where: { id: lead.id },
        data: {
          tier,
          priceCents,
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
        include: { projectType: true, workType: true },
      });
      return {
        lead: routed,
        matches: [{ ...match, contractor: identity.contractor }],
        recipients: 1,
        heldForReview: false,
      };
    }

    if (!lead.contractorCategoryId) {
      const held = await tx.lead.update({
        where: { id: lead.id },
        data: {
          tier,
          priceCents,
          reviewBlocker: REVIEW_BLOCKERS.MISSING_CONTRACTOR_CATEGORY,
          reviewStatus: LeadReviewStatus.PENDING_REVIEW,
          expiresAt: null,
        },
        include: { projectType: true, workType: true },
      });
      return { lead: held, matches: [], recipients: 0, heldForReview: true };
    }

    if (lead.contractorCategory?.code === "other") {
      const eligible = await countEligibleLiveContractors(tx, lead);
      if (eligible === 0) {
        const held = await tx.lead.update({
          where: { id: lead.id },
          data: {
            tier,
            priceCents,
            reviewBlocker: REVIEW_BLOCKERS.OTHER_CATEGORY_CLASSIFICATION_REQUIRED,
            reviewStatus: LeadReviewStatus.PENDING_REVIEW,
            expiresAt: null,
          },
          include: { projectType: true, workType: true },
        });
        return { lead: held, matches: [], recipients: 0, heldForReview: true };
      }
    }

    const expiryHours = await getLeadExpiryHours(tx);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiryHours * 3600 * 1000);
    const maxPurchases =
      lead.maxPurchases > 0 ? lead.maxPurchases : await getMaxLeadPurchases(tx);

    await tx.lead.update({
      where: { id: lead.id },
      data: {
        tier,
        priceCents,
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
    const routed = await tx.lead.update({
      where: { id: lead.id },
      data: { reviewStatus: LeadReviewStatus.ROUTED, routedAt: now },
      include: { projectType: true, workType: true },
    });
    return {
      lead: routed,
      matches: distributed.matches,
      recipients: distributed.matches.length,
      heldForReview: false,
    };
  });

  if (result.heldForReview) {
    if (result.lead.pricingReviewRequired) blockers.push("pricing_review");
    if (result.lead.contractorReviewRequired) blockers.push("contractor_review");
    if (result.lead.reviewBlocker === REVIEW_BLOCKERS.OTHER_CATEGORY_CLASSIFICATION_REQUIRED) {
      blockers.push("category_review");
    }
    if (result.lead.reviewBlocker === REVIEW_BLOCKERS.MISSING_CONTRACTOR_CATEGORY) {
      blockers.push("category_review");
    }
  }

  if (
    !result.heldForReview &&
    result.lead.tier !== null &&
    result.lead.priceCents !== null
  ) {
    await notifyMatches(result.matches, {
      leadId: result.lead.id,
      projectTypeName:
        result.lead.workType?.name ?? result.lead.projectType?.name ?? "Project",
      propertyLocation: result.lead.propertyLocation,
      tier: result.lead.tier,
      priceCents: result.lead.priceCents,
    });
  }
  await writeLeadAudit("lead.routing.finalized", result.lead.id, {
    recipients: result.recipients,
    tier: result.lead.tier,
    priceCents: result.lead.priceCents,
    budgetCents: result.lead.budgetCents,
    budgetBand: result.lead.budgetBand,
    heldForReview: result.heldForReview,
    reviewBlocker: result.lead.reviewBlocker,
  });

  if (!result.heldForReview && result.lead.priceCents === null) {
    throw new InvalidStateError("Lead price snapshot is unresolved.");
  }
  return {
    leadId: result.lead.id,
    priceCents: result.lead.priceCents ?? 0,
    recipients: result.recipients,
    heldForReview: result.heldForReview,
    blockers,
  };
}

async function countEligibleLiveContractors(
  db: DbClient,
  lead: {
    id: string;
    contractorCategoryId: string | null;
    workTypeId: string | null;
    matches: Array<{ contractorId: string }>;
  },
): Promise<number> {
  if (!lead.contractorCategoryId) return 0;
  const alreadyMatchedIds = new Set(lead.matches.map((m) => m.contractorId));
  const candidates = await db.contractor.findMany({
    where: {
      deactivatedAt: null,
      id: { notIn: Array.from(alreadyMatchedIds) },
      OR: [
        { contractorCategoryId: lead.contractorCategoryId },
        {
          categoryMemberships: {
            some: { categoryId: lead.contractorCategoryId },
          },
        },
      ],
    },
    include: { workTypes: { select: { workTypeId: true } } },
  });
  return candidates.filter((contractor) => {
    if (contractor.workTypes.length === 0) return true;
    if (!lead.workTypeId) return false;
    return contractor.workTypes.some((entry) => entry.workTypeId === lead.workTypeId);
  }).length;
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
      isActiveForNewIntake: true,
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

function replayResult(
  existing: {
    id: string;
    payloadHash: string | null;
    reviewStatus: LeadReviewStatus;
    tierReviewRequired: boolean;
    budgetReviewRequired: boolean;
    pricingReviewRequired: boolean;
    contractorReviewRequired: boolean;
  },
  payloadHash: string | null | undefined,
): OfficialEstimateIntakeResult {
  if (existing.payloadHash !== payloadHash) throw new LeadIntakeConflictError();
  const blockers: OfficialEstimateIntakeResult["blockers"] = [];
  if (existing.budgetReviewRequired || existing.tierReviewRequired) {
    blockers.push("budget_review");
  }
  if (existing.pricingReviewRequired) blockers.push("pricing_review");
  if (existing.contractorReviewRequired) blockers.push("contractor_review");
  return {
    leadId: existing.id,
    replay: true,
    reviewStatus: existing.reviewStatus === LeadReviewStatus.ROUTED ? "routed" : "pending_review",
    blockers,
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

async function notifyMatches(
  matches: Array<{
    contractorId: string;
    acceptToken: string;
    contractor: { id: string; name: string; email: string; phone: string };
  }>,
  lead: {
    leadId: string;
    projectTypeName: string;
    propertyLocation: string;
    tier: number;
    priceCents: number;
  },
) {
  await Promise.allSettled(
    matches.map((match) =>
      notifyNewLead({
        contractor: match.contractor,
        acceptToken: match.acceptToken,
        projectTypeName: lead.projectTypeName,
        propertyLocation: lead.propertyLocation,
        tier: lead.tier,
        priceCents: lead.priceCents,
        leadId: lead.leadId,
        contractorId: match.contractorId,
      }),
    ),
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
