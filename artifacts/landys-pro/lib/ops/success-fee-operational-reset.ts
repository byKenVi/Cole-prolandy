/**
 * One-time operational reset for the success-fee product baseline.
 *
 * Removes test/demo pay-per-lead operational data while preserving contractors,
 * admins, canonical live-v3 taxonomy, app settings, and migration history.
 *
 * Default mode is DRY RUN (no writes). Pass execute: true to apply.
 */
import type { PrismaClient } from "@prisma/client";
import {
  LIVE_V3_CATEGORY_CODES,
  LIVE_V3_WORK_TYPE_CODES,
} from "@/lib/taxonomy/live-v3";

export type ResetCounts = {
  contractors: number;
  canonicalCategories: number;
  canonicalWorkTypes: number;
  canonicalCategoryMemberships: number;
  canonicalWorkTypeMappings: number;
  admins: number;
  appSettings: number;
  successFeeTiers: number;
  leads: number;
  leadMatches: number;
  leadAttachments: number;
  successFees: number;
  landownerConfirmations: number;
  followUpTokens: number;
  walletTransactions: number;
  contractorsWithWalletBalance: number;
  walletBalanceCentsTotal: number;
  priceTiers: number;
  workTypePriceTiers: number;
  operationalAuditLogs: number;
  obsoleteCategories: number;
  obsoleteWorkTypes: number;
};

export type ResetPlan = {
  mode: "dry-run" | "execute";
  preserve: {
    contractors: number;
    canonicalCategories: number;
    canonicalWorkTypes: number;
    canonicalCategoryMemberships: number;
    canonicalWorkTypeMappings: number;
    admins: number;
    appSettings: number;
    successFeeTiers: number;
  };
  remove: {
    leads: number;
    leadMatches: number;
    leadAttachments: number;
    successFees: number;
    landownerConfirmations: number;
    followUpTokens: number;
    walletTransactions: number;
    priceTiers: number;
    workTypePriceTiers: number;
    operationalAuditLogs: number;
    walletBalancesToZero: number;
    obsoleteCategoriesToArchive: number;
    obsoleteWorkTypesToArchive: number;
  };
};

/** Audit actions that are operational/business-object noise from PPL testing. */
export const OPERATIONAL_AUDIT_ACTIONS = [
  "LEAD_CREATED",
  "LEAD_ROUTED",
  "LEAD_DISTRIBUTED",
  "LEAD_EXPIRED",
  "LEAD_ACCEPTED",
  "LEAD_DECLINED",
  "LEAD_MATCH_CREATED",
  "LEAD_CHARGE",
  "LEAD_REFUND",
  "WALLET_TOPUP",
  "WALLET_ADJUST",
  "WALLET_RECHARGE",
  "PROMO_CREDIT",
  "CARD_REFUND",
  "JOB_WON",
  "JOB_LOST",
  "SUCCESS_FEE_CREATED",
  "SUCCESS_FEE_DUE",
  "SUCCESS_FEE_PAID",
  "SUCCESS_FEE_MARKED_PAID",
  "FOLLOW_UP_SENT",
  "LANDOWNER_CONFIRMATION",
  "MISMATCH_FLAGGED",
  "MISMATCH_RESOLVED",
] as const;

const CANONICAL_CATEGORY_SET = new Set<string>(LIVE_V3_CATEGORY_CODES);
const CANONICAL_WORK_TYPE_SET = new Set<string>(LIVE_V3_WORK_TYPE_CODES);

export async function collectResetCounts(db: PrismaClient): Promise<ResetCounts> {
  const [
    contractors,
    canonicalCategories,
    canonicalWorkTypes,
    canonicalCategoryMemberships,
    canonicalWorkTypeMappings,
    admins,
    appSettings,
    successFeeTiers,
    leads,
    leadMatches,
    leadAttachments,
    successFees,
    landownerConfirmations,
    followUpTokens,
    walletTransactions,
    walletAgg,
    priceTiers,
    workTypePriceTiers,
    operationalAuditLogs,
    obsoleteCategories,
    obsoleteWorkTypes,
  ] = await Promise.all([
    db.contractor.count(),
    db.contractorCategory.count({
      where: { code: { in: [...LIVE_V3_CATEGORY_CODES] } },
    }),
    db.workType.count({
      where: { code: { in: [...LIVE_V3_WORK_TYPE_CODES] } },
    }),
    db.contractorCategoryMembership.count({
      where: { category: { code: { in: [...LIVE_V3_CATEGORY_CODES] } } },
    }),
    db.contractorWorkType.count({
      where: { workType: { code: { in: [...LIVE_V3_WORK_TYPE_CODES] } } },
    }),
    db.adminUser.count(),
    db.appSetting.count(),
    db.successFeeTier.count(),
    db.lead.count(),
    db.leadMatch.count(),
    db.leadAttachment.count(),
    db.successFee.count(),
    db.landownerConfirmation.count(),
    db.followUpToken.count(),
    db.walletTransaction.count(),
    db.contractor.aggregate({
      _sum: { walletBalanceCents: true },
      _count: { _all: true },
      where: { walletBalanceCents: { not: 0 } },
    }),
    db.priceTier.count(),
    db.workTypePriceTier.count(),
    db.auditLog.count({
      where: { action: { in: [...OPERATIONAL_AUDIT_ACTIONS] } },
    }),
    db.contractorCategory.count({
      where: { code: { notIn: [...LIVE_V3_CATEGORY_CODES] } },
    }),
    db.workType.count({
      where: { code: { notIn: [...LIVE_V3_WORK_TYPE_CODES] } },
    }),
  ]);

  return {
    contractors,
    canonicalCategories,
    canonicalWorkTypes,
    canonicalCategoryMemberships,
    canonicalWorkTypeMappings,
    admins,
    appSettings,
    successFeeTiers,
    leads,
    leadMatches,
    leadAttachments,
    successFees,
    landownerConfirmations,
    followUpTokens,
    walletTransactions,
    contractorsWithWalletBalance: walletAgg._count._all,
    walletBalanceCentsTotal: walletAgg._sum.walletBalanceCents ?? 0,
    priceTiers,
    workTypePriceTiers,
    operationalAuditLogs,
    obsoleteCategories,
    obsoleteWorkTypes,
  };
}

export function buildResetPlan(counts: ResetCounts, execute: boolean): ResetPlan {
  return {
    mode: execute ? "execute" : "dry-run",
    preserve: {
      contractors: counts.contractors,
      canonicalCategories: counts.canonicalCategories,
      canonicalWorkTypes: counts.canonicalWorkTypes,
      canonicalCategoryMemberships: counts.canonicalCategoryMemberships,
      canonicalWorkTypeMappings: counts.canonicalWorkTypeMappings,
      admins: counts.admins,
      appSettings: counts.appSettings,
      successFeeTiers: counts.successFeeTiers,
    },
    remove: {
      leads: counts.leads,
      leadMatches: counts.leadMatches,
      leadAttachments: counts.leadAttachments,
      successFees: counts.successFees,
      landownerConfirmations: counts.landownerConfirmations,
      followUpTokens: counts.followUpTokens,
      walletTransactions: counts.walletTransactions,
      priceTiers: counts.priceTiers,
      workTypePriceTiers: counts.workTypePriceTiers,
      operationalAuditLogs: counts.operationalAuditLogs,
      walletBalancesToZero: counts.contractorsWithWalletBalance,
      obsoleteCategoriesToArchive: counts.obsoleteCategories,
      obsoleteWorkTypesToArchive: counts.obsoleteWorkTypes,
    },
  };
}

export function assertPreservationInvariants(
  before: ResetCounts,
  after: ResetCounts,
): void {
  if (after.contractors !== before.contractors) {
    throw new Error(
      `Preservation failed: contractors ${before.contractors} → ${after.contractors}`,
    );
  }
  if (after.canonicalCategories < before.canonicalCategories) {
    throw new Error(
      `Preservation failed: canonical categories ${before.canonicalCategories} → ${after.canonicalCategories}`,
    );
  }
  if (after.canonicalWorkTypes < before.canonicalWorkTypes) {
    throw new Error(
      `Preservation failed: canonical work types ${before.canonicalWorkTypes} → ${after.canonicalWorkTypes}`,
    );
  }
  if (after.admins !== before.admins) {
    throw new Error(`Preservation failed: admins ${before.admins} → ${after.admins}`);
  }
  if (after.appSettings < before.appSettings) {
    throw new Error(
      `Preservation failed: app settings ${before.appSettings} → ${after.appSettings}`,
    );
  }
  if (after.successFeeTiers !== before.successFeeTiers) {
    throw new Error(
      `Preservation failed: success fee tiers ${before.successFeeTiers} → ${after.successFeeTiers}`,
    );
  }
  if (after.leads !== 0) throw new Error(`Expected 0 leads after reset, got ${after.leads}`);
  if (after.leadMatches !== 0) {
    throw new Error(`Expected 0 lead matches after reset, got ${after.leadMatches}`);
  }
  if (after.successFees !== 0) {
    throw new Error(`Expected 0 success fees after reset, got ${after.successFees}`);
  }
  if (after.landownerConfirmations !== 0) {
    throw new Error(
      `Expected 0 landowner confirmations after reset, got ${after.landownerConfirmations}`,
    );
  }
  if (after.followUpTokens !== 0) {
    throw new Error(`Expected 0 follow-up tokens after reset, got ${after.followUpTokens}`);
  }
  if (after.walletTransactions !== 0) {
    throw new Error(
      `Expected 0 wallet transactions after reset, got ${after.walletTransactions}`,
    );
  }
  if (after.walletBalanceCentsTotal !== 0) {
    throw new Error(
      `Expected $0 wallet balances after reset, got ${after.walletBalanceCentsTotal} cents`,
    );
  }
  if (after.priceTiers !== 0 || after.workTypePriceTiers !== 0) {
    throw new Error("Expected legacy pricing rows to be cleared after reset");
  }
}

export function formatResetReport(plan: ResetPlan, phase: "before" | "after" = "before"): string {
  const lines = [
    `=== Success-fee operational reset (${plan.mode}) — ${phase} ===`,
    "",
    "PRESERVE",
    `  Contractors preserved: ${plan.preserve.contractors}`,
    `  Canonical categories preserved: ${plan.preserve.canonicalCategories}`,
    `  Canonical work types preserved: ${plan.preserve.canonicalWorkTypes}`,
    `  Canonical category mappings preserved: ${plan.preserve.canonicalCategoryMemberships}`,
    `  Canonical work-type mappings preserved: ${plan.preserve.canonicalWorkTypeMappings}`,
    `  Admins preserved: ${plan.preserve.admins}`,
    `  App settings preserved: ${plan.preserve.appSettings}`,
    `  Success-fee tiers preserved: ${plan.preserve.successFeeTiers}`,
    "",
    "REMOVE / RESET",
    `  Leads to delete: ${plan.remove.leads}`,
    `  LeadMatches to delete: ${plan.remove.leadMatches}`,
    `  LeadAttachments to delete: ${plan.remove.leadAttachments}`,
    `  SuccessFees to delete: ${plan.remove.successFees}`,
    `  Confirmations to delete: ${plan.remove.landownerConfirmations}`,
    `  FollowUpTokens to delete: ${plan.remove.followUpTokens}`,
    `  WalletTransactions to delete: ${plan.remove.walletTransactions}`,
    `  Wallet balances to zero: ${plan.remove.walletBalancesToZero}`,
    `  Legacy PriceTier to delete: ${plan.remove.priceTiers}`,
    `  Legacy WorkTypePriceTiers to delete: ${plan.remove.workTypePriceTiers}`,
    `  Operational audit logs to delete: ${plan.remove.operationalAuditLogs}`,
    `  Obsolete categories to archive: ${plan.remove.obsoleteCategoriesToArchive}`,
    `  Obsolete work types to archive: ${plan.remove.obsoleteWorkTypesToArchive}`,
    "",
    `Canonical taxonomy source: lib/taxonomy/live-v3.ts (${LIVE_V3_CATEGORY_CODES.length} categories, ${LIVE_V3_WORK_TYPE_CODES.length} work types)`,
  ];
  return lines.join("\n");
}

export async function runOperationalReset(
  db: PrismaClient,
  opts: { execute?: boolean } = {},
): Promise<{ plan: ResetPlan; before: ResetCounts; after: ResetCounts | null }> {
  const execute = Boolean(opts.execute);
  const before = await collectResetCounts(db);
  const plan = buildResetPlan(before, execute);

  if (!execute) {
    return { plan, before, after: null };
  }

  await db.$transaction(async (tx) => {
    // Clear FK-sensitive operational children first.
    await tx.followUpToken.deleteMany({});
    await tx.landownerConfirmation.deleteMany({});
    await tx.successFee.deleteMany({});
    await tx.walletTransaction.deleteMany({});
    await tx.leadAttachment.deleteMany({});
    await tx.leadMatch.deleteMany({});
    await tx.lead.deleteMany({});

    // Legacy pay-per-lead pricing configuration (schema retained, rows cleared).
    await tx.workTypePriceTier.deleteMany({});
    await tx.priceTier.deleteMany({});

    await tx.contractor.updateMany({
      where: { walletBalanceCents: { not: 0 } },
      data: { walletBalanceCents: 0 },
    });

    await tx.auditLog.deleteMany({
      where: { action: { in: [...OPERATIONAL_AUDIT_ACTIONS] } },
    });

    // Archive obsolete taxonomy for new intake; never delete contractors.
    const obsoleteCategories = await tx.contractorCategory.findMany({
      where: { code: { notIn: [...LIVE_V3_CATEGORY_CODES] } },
      select: { id: true, code: true },
    });
    for (const cat of obsoleteCategories) {
      if (CANONICAL_CATEGORY_SET.has(cat.code)) continue;
      await tx.contractorCategory.update({
        where: { id: cat.id },
        data: { archivedAt: new Date(), isActiveForNewIntake: false },
      });
    }

    const obsoleteWorkTypes = await tx.workType.findMany({
      where: { code: { notIn: [...LIVE_V3_WORK_TYPE_CODES] } },
      select: { id: true, code: true },
    });
    for (const wt of obsoleteWorkTypes) {
      if (CANONICAL_WORK_TYPE_SET.has(wt.code)) continue;
      await tx.workType.update({
        where: { id: wt.id },
        data: { archivedAt: new Date(), isActiveForNewIntake: false },
      });
    }
  });

  const after = await collectResetCounts(db);
  assertPreservationInvariants(before, after);
  return { plan: buildResetPlan(after, true), before, after };
}
