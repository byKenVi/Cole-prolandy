import { prisma } from "@/lib/prisma";
import { APP_SETTING_KEYS } from "@/lib/domain/types";
import type { Prisma } from "@prisma/client";
import { PrismaContractorSyncStore } from "@/lib/integrations/contractors/prisma-store";
import { syncContractor } from "@/lib/integrations/contractors/sync-service";
import type {
  ContractorSyncOwnershipPolicy,
  ContractorSyncResult,
} from "@/lib/integrations/contractors/contract";
import {
  normalizeWixContractorRecord,
  parseWixDate,
  resolveOfficialCategoryCode,
  type NormalizedWixContractor,
  type WixAllContractorItem,
} from "@/lib/integrations/wix/contractor-adapter";
import {
  fetchAllWixContractors,
  fetchWixContractorById,
  getWixConfig,
} from "@/lib/integrations/wix/wix-client";
import { ensureCategory } from "@/lib/services/taxonomy-registry";

/**
 * landys.co (Wix CMS) owns the contractor directory: profile, categories,
 * service area and active status. Landy's Pro owns money, leads, accounts and
 * admin decisions. In particular, a contractor deactivated by an ADMIN here is
 * never reactivated by the sync; one deactivated because landys.co marked it
 * inactive is reactivated when landys.co marks it active again.
 */
export const WIX_CONTRACTOR_SYNC_POLICY: ContractorSyncOwnershipPolicy = {
  allowCreate: true,
  writableProfileFields: ["name", "email", "phone", "aboutSection", "contractorCategory"],
};

export type WixContractorSyncSummary = {
  dryRun: boolean;
  fetched: number;
  created: number;
  updated: number;
  unchanged: number;
  /** Records skipped (missing _id, name or email). */
  invalidIdentity: number;
  /** Newly deactivated because landys.co marks them inactive. */
  deactivated: number;
  /** Newly reactivated because landys.co marks them active again. */
  reactivated: number;
  /** Active on landys.co but deactivated here by an admin (left as is). */
  keptDeactivatedByAdmin: number;
  withoutServiceArea: number;
  categoriesCreated: string[];
  errors: string[];
  unresolvedCategories: string[];
  unresolvedProjectTypes: string[];
  unresolvedLandTypes: string[];
  skipped: Array<{ externalId: string; reason: string }>;
  /** Field keys seen on the first items — lets admins verify the mapping. */
  sampleKeys: string[];
};

function emptySummary(dryRun: boolean): WixContractorSyncSummary {
  return {
    dryRun,
    fetched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    invalidIdentity: 0,
    deactivated: 0,
    reactivated: 0,
    keptDeactivatedByAdmin: 0,
    withoutServiceArea: 0,
    categoriesCreated: [],
    errors: [],
    unresolvedCategories: [],
    unresolvedProjectTypes: [],
    unresolvedLandTypes: [],
    skipped: [],
    sampleKeys: [],
  };
}

export async function runWixContractorSync(options: {
  dryRun?: boolean;
  incremental?: boolean;
} = {}): Promise<WixContractorSyncSummary> {
  const dryRun = options.dryRun ?? false;
  if (!getWixConfig()) throw new Error("Wix contractor sync is not configured.");
  const summary = emptySummary(dryRun);

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

  if (!dryRun) {
    await prisma.appSetting.upsert({
      where: { key: APP_SETTING_KEYS.wixContractorSyncLastAttemptAt },
      update: { value: new Date().toISOString() },
      create: { key: APP_SETTING_KEYS.wixContractorSyncLastAttemptAt, value: new Date().toISOString() },
    });
  }

  let items: Record<string, unknown>[];
  try {
    items = await fetchAllWixContractors(updatedAfter);
  } catch (error) {
    summary.errors.push(error instanceof Error ? error.message : "Wix fetch failed.");
    if (!dryRun) await persistSyncSummary(summary);
    throw error;
  }

  summary.fetched = items.length;
  summary.sampleKeys = [...new Set(items.slice(0, 5).flatMap((item) => Object.keys(item)))].sort();

  for (const raw of items) {
    await syncOneItem(raw, { dryRun, summary });
  }

  summary.unresolvedCategories = [...new Set(summary.unresolvedCategories)];
  summary.unresolvedProjectTypes = [...new Set(summary.unresolvedProjectTypes)];
  summary.unresolvedLandTypes = [...new Set(summary.unresolvedLandTypes)];
  summary.categoriesCreated = [...new Set(summary.categoriesCreated)];

  if (!dryRun) {
    if (summary.errors.length === 0) {
      await prisma.appSetting.upsert({
        where: { key: APP_SETTING_KEYS.wixContractorSyncLastSuccessAt },
        update: { value: new Date().toISOString() },
        create: { key: APP_SETTING_KEYS.wixContractorSyncLastSuccessAt, value: new Date().toISOString() },
      });
    }
    await persistSyncSummary(summary);
    await prisma.auditLog.create({
      data: {
        actorType: "system",
        action: "wix.contractor_sync.completed",
        metadata: { ...summary, skipped: summary.skipped.slice(0, 50) } as unknown as Prisma.InputJsonObject,
      },
    });
  }

  return summary;
}

/** Sync a single contractor (direct requests naming a pro we have not seen yet). */
export async function syncWixContractorById(externalId: string): Promise<boolean> {
  if (!getWixConfig()) return false;
  const item = await fetchWixContractorById(externalId);
  if (!item) return false;
  const summary = emptySummary(false);
  await syncOneItem(item, { dryRun: false, summary });
  return summary.created + summary.updated + summary.unchanged > 0;
}

async function syncOneItem(
  raw: Record<string, unknown>,
  ctx: { dryRun: boolean; summary: WixContractorSyncSummary },
) {
  const { summary, dryRun } = ctx;
  const id = typeof raw._id === "string" ? raw._id : null;
  if (!id) {
    summary.skipped.push({ externalId: "unknown", reason: "Missing Wix _id." });
    summary.invalidIdentity += 1;
    return;
  }
  const normalized = normalizeWixContractorRecord(raw as WixAllContractorItem);

  // Create every category landys.co uses (dry-run only reports them).
  const categoryIds: string[] = [];
  let primaryCode: string | undefined;
  for (const label of normalized.categoryLabels) {
    if (dryRun) {
      const code = resolveOfficialCategoryCode(label);
      if (code && !(await prisma.contractorCategory.findUnique({ where: { code }, select: { id: true } }))) {
        summary.categoriesCreated.push(`${label} (would be created)`);
      }
      continue;
    }
    try {
      const ref = await ensureCategory(prisma, label);
      if (!ref) continue;
      if (ref.created) summary.categoriesCreated.push(ref.name);
      categoryIds.push(ref.id);
      primaryCode ??= ref.code;
    } catch (error) {
      summary.unresolvedCategories.push(label);
      console.error("[wix-sync] category creation failed", { label, error });
    }
  }
  if (primaryCode) normalized.record.contractorCategoryCode = primaryCode;

  let result: ContractorSyncResult;
  try {
    result = await syncContractor(new PrismaContractorSyncStore(prisma), normalized.record, WIX_CONTRACTOR_SYNC_POLICY, {
      dryRun,
    });
  } catch (error) {
    summary.errors.push(`${id}: ${error instanceof Error ? error.message : "sync failed"}`);
    return;
  }

  if (result.status === "unresolved") {
    summary.invalidIdentity += 1;
    summary.skipped.push({
      externalId: id,
      reason: result.reasons.join("; ") || "Missing required profile fields.",
    });
    return;
  }
  if (result.status === "created") summary.created += 1;
  else if (result.status === "updated") summary.updated += 1;
  else summary.unchanged += 1;

  if (normalized.serviceZipCodes.length === 0 && normalized.serviceCounties.length === 0) {
    summary.withoutServiceArea += 1;
  }

  if (!dryRun && result.contractorId) {
    const transition = await applyWixOperationalUpdates({
      contractorId: result.contractorId,
      externalId: id,
      normalized,
      sourceUpdatedAt: parseWixDate(normalized.metadata.wixUpdatedDate),
      categoryIds,
    });
    if (transition === "deactivated") summary.deactivated += 1;
    if (transition === "reactivated") summary.reactivated += 1;
    if (transition === "kept_admin_deactivation") summary.keptDeactivatedByAdmin += 1;
  }
}

async function applyWixOperationalUpdates(params: {
  contractorId: string;
  externalId: string;
  normalized: NormalizedWixContractor;
  sourceUpdatedAt: string | undefined;
  categoryIds: string[];
}): Promise<"deactivated" | "reactivated" | "kept_admin_deactivation" | null> {
  const { normalized } = params;
  await prisma.externalContractorIdentity.update({
    where: { source_externalId: { source: "wix", externalId: params.externalId } },
    data: {
      sourceMetadata: { ...normalized.metadata, rawKeys: normalized.rawKeys } as Prisma.InputJsonObject,
      sourceUpdatedAt: params.sourceUpdatedAt ? new Date(params.sourceUpdatedAt) : null,
      lastSyncedAt: new Date(),
    },
  });

  const current = await prisma.contractor.findUnique({
    where: { id: params.contractorId },
    select: { deactivatedAt: true, deactivationSource: true },
  });

  let transition: "deactivated" | "reactivated" | "kept_admin_deactivation" | null = null;
  const data: Prisma.ContractorUpdateInput = {
    serviceZipCodes: normalized.serviceZipCodes,
    serviceCounties: normalized.serviceCounties,
    websiteUrl: normalized.websiteUrl,
  };
  if (!normalized.isActive && !current?.deactivatedAt) {
    data.deactivatedAt = new Date();
    data.deactivationSource = "wix";
    transition = "deactivated";
  } else if (normalized.isActive && current?.deactivatedAt) {
    if (current.deactivationSource === "wix") {
      data.deactivatedAt = null;
      data.deactivationSource = null;
      transition = "reactivated";
    } else {
      transition = "kept_admin_deactivation";
    }
  }
  await prisma.contractor.update({ where: { id: params.contractorId }, data });

  // Memberships mirror landys.co categories (primary first, then secondary).
  for (const [index, categoryId] of params.categoryIds.entries()) {
    await prisma.contractorCategoryMembership.upsert({
      where: { contractorId_categoryId: { contractorId: params.contractorId, categoryId } },
      update: { isPrimary: index === 0, displayOrder: index },
      create: {
        contractorId: params.contractorId,
        categoryId,
        isPrimary: index === 0,
        displayOrder: index,
      },
    });
  }
  if (params.categoryIds.length > 0) {
    await prisma.contractorCategoryMembership.deleteMany({
      where: { contractorId: params.contractorId, categoryId: { notIn: params.categoryIds } },
    });
    await prisma.contractor.update({
      where: { id: params.contractorId },
      data: { contractorCategoryId: params.categoryIds[0] },
    });
  }
  return transition;
}

async function persistSyncSummary(summary: WixContractorSyncSummary) {
  const value = JSON.stringify({ ...summary, skipped: summary.skipped.slice(0, 100) });
  await prisma.appSetting.upsert({
    where: { key: APP_SETTING_KEYS.wixContractorSyncLastResult },
    update: { value },
    create: { key: APP_SETTING_KEYS.wixContractorSyncLastResult, value },
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
