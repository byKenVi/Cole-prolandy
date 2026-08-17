import {
  LeadMatchStatus,
  LeadReviewStatus,
  LeadRoutingMode,
  LeadStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { distributeLead } from "@/lib/domain/leads";
import { resolveBudgetCents } from "@/lib/domain/budget";
import { snapshotLeadPricing } from "@/lib/domain/tier-resolution";
import { resolvePrice } from "@/lib/domain/pricing";
import { getLeadExpiryHours, getMaxLeadPurchases } from "@/lib/domain/settings";
import { InvalidStateError, NotFoundError } from "@/lib/domain/errors";
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
  timeline?: Date | null;
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
  blockers: Array<"budget_review" | "contractor_review" | "attachment_ingestion">;
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

  const [projectType, landType, category] = await Promise.all([
    prisma.projectType.findFirst({
      where: { code: input.projectTypeCode, archivedAt: null },
      select: { id: true, contractorTypeId: true, name: true },
    }),
    prisma.landType.findFirst({
      where: { code: input.landTypeCode, archivedAt: null },
      select: { id: true },
    }),
    input.contractorCategoryCode
      ? prisma.contractorCategory.findFirst({
          where: { code: input.contractorCategoryCode, archivedAt: null },
          select: { id: true },
        })
      : null,
  ]);
  if (!projectType) throw new NotFoundError("Active project type");
  if (!landType) throw new NotFoundError("Active land type");
  if (input.contractorCategoryCode && !category) {
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
        contractorReviewRequired: true,
      },
    });
    if (existing) return replayResult(existing, input.payloadHash);
  }

  const budget = resolveBudgetCents({
    budgetCents: input.budgetCents,
    budget: input.budget,
  });
  const budgetReviewRequired = !budget.ok;

  let contractorReviewRequired = false;
  let resolvedExternalId = input.routing.mode === "direct" ? input.routing.contractorExternalId : null;
  if (input.routing.mode === "direct") {
    const resolved = await resolveWixContractorExternalId(
      prisma,
      input.routing.contractorExternalId,
    );
    resolvedExternalId = resolved.externalId;
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
    landType: { connect: { id: landType.id } },
    projectType: { connect: { id: projectType.id } },
    description: clean(input.description),
    budget: budget.ok ? budget.budgetRaw : clean(input.budget),
    budgetCents: budget.ok ? budget.budgetCents : null,
    timeline: input.timeline ?? null,
    urgency: clean(input.urgency),
    tier: null,
    priceCents: null,
    maxPurchases: maxPurchasesDefault,
    status: LeadStatus.NEW,
    reviewStatus: LeadReviewStatus.PENDING_REVIEW,
    tierReviewRequired: budgetReviewRequired,
    budgetReviewRequired,
    contractorReviewRequired,
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
  if (contractorReviewRequired) blockers.push("contractor_review");
  if (attachmentResult.hasFailures) blockers.push("attachment_ingestion");

  await writeLeadAudit("lead.request.created", leadId, {
    source: input.source,
    externalRequestId: input.externalRequestId ?? null,
    routingMode: input.routing.mode,
    blockers,
    budgetCents: budget.ok ? budget.budgetCents : null,
  });

  if (!budgetReviewRequired && !contractorReviewRequired) {
    const routed = await autoRouteLead({
      leadId,
      actorId: null,
    });
    return {
      leadId,
      replay: false,
      reviewStatus: routed.heldForContractorReview ? "pending_review" : "routed",
      blockers: routed.heldForContractorReview
        ? [...blockers, "contractor_review"]
        : blockers.filter((b) => b !== "budget_review"),
    };
  }

  return {
    leadId,
    replay: false,
    reviewStatus: "pending_review",
    blockers,
  };
}

export async function finalizeLeadForRouting(params: {
  leadId: string;
  budgetCents?: number;
  actorId?: string | null;
}): Promise<LeadIntakeResult & { heldForContractorReview: boolean }> {
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
  return autoRouteLead(params);
}

async function autoRouteLead(params: {
  leadId: string;
  actorId?: string | null;
}): Promise<LeadIntakeResult & { heldForContractorReview: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.findUnique({
      where: { id: params.leadId },
      include: { projectType: true, matches: true },
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
        heldForContractorReview: false,
      };
    }

    if (lead.budgetCents == null || lead.budgetReviewRequired) {
      throw new InvalidStateError("This lead requires budget review before routing.");
    }

    const pricing = await snapshotLeadPricing(tx, {
      contractorTypeId: lead.projectType.contractorTypeId,
      projectTypeId: lead.projectTypeId,
      budgetCents: lead.budgetCents,
    });

    const priceCents = lead.priceCents ?? pricing.priceCents;
    const tier = lead.tier ?? pricing.tier;

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
            contractorReviewRequired: true,
            reviewStatus: LeadReviewStatus.PENDING_REVIEW,
            maxPurchases: 1,
            expiresAt: null,
          },
          include: { projectType: true },
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
        return {
          lead: held,
          matches: [],
          recipients: 0,
          heldForContractorReview: true,
        };
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
          contractorReviewRequired: false,
          reviewStatus: LeadReviewStatus.ROUTED,
          status: LeadStatus.DISTRIBUTED,
          maxPurchases: 1,
          routedAt: now,
          expiresAt,
        },
        include: { projectType: true },
      });
      return {
        lead: routed,
        matches: [{ ...match, contractor: identity.contractor }],
        recipients: 1,
        heldForContractorReview: false,
      };
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
        contractorReviewRequired: false,
        reviewStatus: LeadReviewStatus.READY,
        maxPurchases,
        expiresAt,
      },
    });
    const distributed = await distributeLead(tx, lead.id);
    const routed = await tx.lead.update({
      where: { id: lead.id },
      data: { reviewStatus: LeadReviewStatus.ROUTED, routedAt: now },
      include: { projectType: true },
    });
    return {
      lead: routed,
      matches: distributed.matches,
      recipients: distributed.matches.length,
      heldForContractorReview: false,
    };
  });

  if (
    !result.heldForContractorReview &&
    result.lead.tier !== null &&
    result.lead.priceCents !== null
  ) {
    await notifyMatches(result.matches, {
      leadId: result.lead.id,
      projectTypeName: result.lead.projectType.name,
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
    heldForContractorReview: result.heldForContractorReview,
  });

  if (result.lead.priceCents === null) {
    throw new InvalidStateError("Lead price snapshot is unresolved.");
  }
  return {
    leadId: result.lead.id,
    priceCents: result.lead.priceCents,
    recipients: result.recipients,
    heldForContractorReview: result.heldForContractorReview,
  };
}

function replayResult(
  existing: {
    id: string;
    payloadHash: string | null;
    reviewStatus: LeadReviewStatus;
    tierReviewRequired: boolean;
    budgetReviewRequired: boolean;
    contractorReviewRequired: boolean;
  },
  payloadHash: string | null | undefined,
): OfficialEstimateIntakeResult {
  if (existing.payloadHash !== payloadHash) throw new LeadIntakeConflictError();
  const blockers: OfficialEstimateIntakeResult["blockers"] = [];
  if (existing.budgetReviewRequired || existing.tierReviewRequired) {
    blockers.push("budget_review");
  }
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
