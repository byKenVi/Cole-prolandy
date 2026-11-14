import type { PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";
import {
  LIVE_V3_CATEGORY_NAMES,
  LIVE_V3_LAND_TYPE_NAMES,
  LIVE_V3_WORK_TYPE_NAMES,
} from "@/lib/taxonomy/live-v3";

/**
 * Idempotent reference-data bootstrap, run once at server start.
 *
 * Replit Publish copies the database SCHEMA to production but not the rows that
 * Prisma migrations insert. Without this, a fresh production database has no
 * settings, no success-fee tiers and no taxonomy. Every write below is
 * insert-if-missing: it never overwrites a value an admin has changed.
 */
export const DEFAULT_SUCCESS_FEE_TIERS = [
  { id: "sft_small", sortOrder: 1, maxValueCents: 999_999, rateBasisPoints: 500 },
  { id: "sft_medium", sortOrder: 2, maxValueCents: 2_499_999, rateBasisPoints: 400 },
  { id: "sft_large", sortOrder: 3, maxValueCents: null, rateBasisPoints: 300 },
] as const;

export type BootstrapResult = {
  settingsInserted: number;
  feeTiersInserted: number;
  categoriesInserted: number;
  workTypesInserted: number;
  landTypesInserted: number;
};

export async function ensureReferenceData(db: PrismaClient): Promise<BootstrapResult> {
  const settings = await db.appSetting.createMany({
    data: Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })),
    skipDuplicates: true,
  });

  // Tiers are only seeded into an EMPTY table: admins may have reshaped them.
  let feeTiersInserted = 0;
  if ((await db.successFeeTier.count()) === 0) {
    const tiers = await db.successFeeTier.createMany({
      data: DEFAULT_SUCCESS_FEE_TIERS.map((tier) => ({ ...tier })),
      skipDuplicates: true,
    });
    feeTiersInserted = tiers.count;
  }

  const categories = await db.contractorCategory.createMany({
    data: [...LIVE_V3_CATEGORY_NAMES].map(([code, name]) => ({
      code,
      name,
      isActiveForNewIntake: true,
    })),
    skipDuplicates: true,
  });
  const workTypes = await db.workType.createMany({
    data: [...LIVE_V3_WORK_TYPE_NAMES].map(([code, name]) => ({
      code,
      name,
      isActiveForNewIntake: true,
    })),
    skipDuplicates: true,
  });
  const landTypes = await db.landType.createMany({
    data: [...LIVE_V3_LAND_TYPE_NAMES].map(([code, name]) => ({
      code,
      name,
      isActiveForNewIntake: true,
    })),
    skipDuplicates: true,
  });

  return {
    settingsInserted: settings.count,
    feeTiersInserted,
    categoriesInserted: categories.count,
    workTypesInserted: workTypes.count,
    landTypesInserted: landTypes.count,
  };
}
