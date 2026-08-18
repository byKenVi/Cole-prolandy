import { prisma } from "@/lib/prisma";
import { APP_SETTING_KEYS } from "@/lib/domain/types";
import type { Prisma } from "@prisma/client";
import { PrismaContractorSyncStore } from "@/lib/integrations/contractors/prisma-store";
import {
  syncContractor,
} from "@/lib/integrations/contractors/sync-service";
import type { ContractorSyncResult } from "@/lib/integrations/contractors/contract";
import type { ContractorSyncOwnershipPolicy } from "@/lib/integrations/contractors/contract";
import {
  normalizeWixContractorRecord,
  parseWixDate,
  resolveOfficialCategoryCode,
  type WixAllContractorItem,
} from "@/lib/integrations/wix/contractor-adapter";
import { fetchAllWixContractors, getWixConfig } from "@/lib/integrations/wix/wix-client";

export const WIX_CONTRACTOR_SYNC_POLICY: ContractorSyncOwnershipPolicy = {
  allowCreate: true,
  writableProfileFields: [
    "name",
    "email",
    "phone",
    "aboutSection",
    "businessHours",
    "contractorCategory",
    "projects",
  ],
};

export type WixContractorSyncSummary = {
  dryRun: boolean;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Records skipped due to invalid identity (missing _id, missing required profile fields). */
  invalidIdentity: number;
  deactivated: number;
  reactivated: number;
  errors: string[];
  unresolvedCategories: string[];
  unresolvedProjectTypes: string[];
  unresolvedLandTypes: string[];
  skipped: Array<{ externalId: string; reason: string }>;
};

export async function runWixContractorSync(options: {
  dryRun?: boolean;
  incremental?: boolean;
} = {}): Promise<WixContractorSyncSummary> {
  const dryRun = options.dryRun ?? false;
  const config = getWixConfig();
  if (!config) throw new Error("Wix contractor sync is not configured.");

  const store = new PrismaContractorSyncStore(prisma);
  const summary: WixContractorSyncSummary = {
    dryRun,
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    invalidIdentity: 0,
    deactivated: 0,
    reactivated: 0,
    errors: [],
    unresolvedCategories: [],
    unresolvedProjectTypes: [],
    unresolvedLandTypes: [],
    skipped: [],
  };

  let updatedAfter: Date | undefined;
  if (options.incremental) {
    const checkpoint = await prisma.appSetting.findUnique({
      where: { key: APP_SETTING_KEYS.wixContractorSyncLastSuccessAt },
    });
    if (checkpoint?.value) {
      const parsed = new Date(checkpoint.value);
      if (!Number.isNaN(parsed.getTime())) {
        updatedAfter = new Date(parsed.getTime() - 5 * 60 * 1000);
      }
    }
  }

  await prisma.appSetting.upsert({
    where: { key: APP_SETTING_KEYS.wixContractorSyncLastAttemptAt },
    update: { value: new Date().toISOString() },
    create: { key: APP_SETTING_KEYS.wixContractorSyncLastAttemptAt, value: new Date().toISOString() },
  });

  let items: Record<string, unknown>[];
  try {
    items = await fetchAllWixContractors(updatedAfter);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wix fetch failed.";
    summary.errors.push(message);
    await persistSyncSummary(summary);
    throw error;
  }

  summary.fetched = items.length;

  for (const raw of items) {
    const item = raw as WixAllContractorItem;
    if (!item._id) {
      summary.skipped.push({ externalId: "unknown", reason: "Missing Wix _id." });
      summary.invalidIdentity += 1;
      continue;
    }

    const normalized = normalizeWixContractorRecord(item);
    summary.unresolvedCategories.push(...normalized.unresolvedCategories);
    summary.unresolvedProjectTypes.push(...normalized.unresolvedProjectTypes);
    summary.unresolvedLandTypes.push(...normalized.unresolvedLandTypes);

    // Skip inactive contractors that have no name — they cannot be meaningfully created.
    if (!normalized.isActive && !normalized.record.profile?.name) {
      summary.skipped.push({
        externalId: item._id,
        reason: "Inactive contractor with no name skipped.",
      });
      summary.invalidIdentity += 1;
      continue;
    }

    let result: ContractorSyncResult;
    try {
      result = await syncContractor(store, normalized.record, WIX_CONTRACTOR_SYNC_POLICY, {
        dryRun,
      });
    } catch (error) {
      summary.errors.push(
        `${item._id}: ${error instanceof Error ? error.message : "sync failed"}`,
      );
      continue;
    }

    if (result.status === "created") summary.created += 1;
    else if (result.status === "updated") summary.updated += 1;
    else if (result.status === "unchanged") summary.unchanged += 1;
    else {
      // Unresolved = missing required profile fields (name/email/phone).
      summary.invalidIdentity += 1;
      summary.skipped.push({
        externalId: item._id,
        reason: result.reasons.join("; ") || "Missing required profile fields.",
      });
      continue;
    }

    if (!dryRun && result.contractorId) {
      await applyWixOperationalUpdates({
        contractorId: result.contractorId,
        externalId: item._id,
        isActive: normalized.isActive,
        metadata: normalized.metadata,
        sourceUpdatedAt: parseWixDate(item._updatedDate) ? new Date(parseWixDate(item._updatedDate)!) : null,
        categoryLabels: item.contractorsCategory ?? [],
      });

      if (normalized.isActive) summary.reactivated += 1;
      else summary.deactivated += 1;
    }
  }

  summary.unresolvedCategories = [...new Set(summary.unresolvedCategories)];
  summary.unresolvedProjectTypes = [...new Set(summary.unresolvedProjectTypes)];
  summary.unresolvedLandTypes = [...new Set(summary.unresolvedLandTypes)];

  if (!dryRun && summary.errors.length === 0) {
    await prisma.appSetting.upsert({
      where: { key: APP_SETTING_KEYS.wixContractorSyncLastSuccessAt },
      update: { value: new Date().toISOString() },
      create: {
        key: APP_SETTING_KEYS.wixContractorSyncLastSuccessAt,
        value: new Date().toISOString(),
      },
    });
  }

  await persistSyncSummary(summary);
  await prisma.auditLog.create({
    data: {
      actorType: "system",
      action: "wix.contractor_sync.completed",
      metadata: summary as unknown as Prisma.InputJsonObject,
    },
  });

  return summary;
}

async function applyWixOperationalUpdates(params: {
  contractorId: string;
  externalId: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  sourceUpdatedAt: Date | null;
  categoryLabels: string[];
}) {
  await prisma.externalContractorIdentity.update({
    where: { source_externalId: { source: "wix", externalId: params.externalId } },
    data: {
      sourceMetadata: params.metadata as object,
      sourceUpdatedAt: params.sourceUpdatedAt,
      lastSyncedAt: new Date(),
    },
  });

  await prisma.contractor.update({
    where: { id: params.contractorId },
    data: {
      deactivatedAt: params.isActive ? null : new Date(),
    },
  });

  const categoryIds: string[] = [];
  for (const [index, label] of params.categoryLabels.entries()) {
    const code = resolveOfficialCategoryCode(label);
    if (!code) continue;
    const category = await prisma.contractorCategory.findFirst({
      where: { code, archivedAt: null },
      select: { id: true },
    });
    if (!category) continue;
    categoryIds.push(category.id);
    await prisma.contractorCategoryMembership.upsert({
      where: {
        contractorId_categoryId: {
          contractorId: params.contractorId,
          categoryId: category.id,
        },
      },
      update: { isPrimary: index === 0, displayOrder: index },
      create: {
        contractorId: params.contractorId,
        categoryId: category.id,
        isPrimary: index === 0,
        displayOrder: index,
      },
    });
  }

  if (categoryIds[0]) {
    await prisma.contractor.update({
      where: { id: params.contractorId },
      data: { contractorCategoryId: categoryIds[0] },
    });
  }
}

async function persistSyncSummary(summary: WixContractorSyncSummary) {
  await prisma.appSetting.upsert({
    where: { key: APP_SETTING_KEYS.wixContractorSyncLastResult },
    update: { value: JSON.stringify(summary) },
    create: {
      key: APP_SETTING_KEYS.wixContractorSyncLastResult,
      value: JSON.stringify(summary),
    },
  });
}

export async function getLastWixSyncResult(): Promise<WixContractorSyncSummary | null> {
  const row = await prisma.appSetting.findUnique({
    where: { key: APP_SETTING_KEYS.wixContractorSyncLastResult },
  });
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as WixContractorSyncSummary;
  } catch {
    return null;
  }
}
