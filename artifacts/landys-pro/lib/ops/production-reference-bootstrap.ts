import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CATEGORIES = [
  ["ccat_v3_general_contractor", "General Contractor", "general-contractor"],
  ["ccat_v3_roofing", "Roofing", "roofing"],
  ["ccat_v3_plumbing", "Plumbing", "plumbing"],
  ["ccat_v3_electrical", "Electrical", "electrical"],
  ["ccat_v3_hvac", "HVAC", "hvac"],
  ["ccat_v3_landscaping", "Landscaping", "landscaping"],
  ["ccat_v3_flooring", "Flooring", "flooring"],
  ["ccat_v3_painting", "Painting", "painting"],
  ["ccat_v3_kitchen_bath", "Kitchen & Bath", "kitchen-bath"],
  ["ccat_v3_foundation_concrete", "Foundation & Concrete", "foundation-concrete"],
  ["ccat_v3_other", "Other", "other"],
] as const;

const WORK_TYPES = [
  ["wtype_new_build", "New Build", "new-build"],
  ["wtype_renovation_remodel", "Renovation / Remodel", "renovation-remodel"],
  ["wtype_repair", "Repair", "repair"],
  ["wtype_addition", "Addition", "addition"],
  ["wtype_installation", "Installation", "installation"],
  ["wtype_maintenance", "Maintenance", "maintenance"],
  ["wtype_inspection", "Inspection", "inspection"],
] as const;

const LAND_TYPES = [
  ["ltype_v3_residential", "Residential", "residential"],
  ["ltype_v3_commercial", "Commercial", "commercial"],
  ["ltype_v3_multi_family", "Multi-family", "multi-family"],
  ["ltype_v3_rural_land", "Rural / Land", "rural-land"],
] as const;

const PROJECTS = [
  ["CULVERT INSTALL", "culvert-install"],
  ["BARNDOMINIUM BUILDING", "barndominium-building"],
  ["BRUSH HOGGING", "brush-hogging"],
  ["POND BUILDING", "pond-building"],
  ["CABIN CONSTRUCTION", "cabin-construction"],
  ["DRIVEWAY CONSTRUCTION", "driveway-construction"],
  ["WATER WELL DRILLING", "water-well-drilling"],
  ["GATED ENTRANCE", "gated-entrance"],
  ["DRAINAGE IMPROVEMENT", "drainage-improvement"],
  ["IRRIGATION SYSTEM INSTALLATION", "irrigation-system-installation"],
  ["RETAINING WALL CONSTRUCTION", "retaining-wall-construction"],
  ["UTILITY TRENCHING", "utility-trenching"],
  ["TREE REMOVAL & STUMP GRINDING", "tree-removal-stump-grinding"],
  ["LAND GRADING & LEVELING", "land-grading-leveling"],
] as const;

const SETTINGS = [
  ["environmentName", "production"],
  ["maxLeadRecipients", "3"],
  ["maxLeadPurchases", "3"],
  ["leadExpiryHours", "48"],
  ["acceptanceUnlimited", "false"],
  ["followUpOutcomeDelayHours", "72"],
  ["followUpPaymentDelayHours", "336"],
  ["followUpPaymentRetryHours", "168"],
] as const;

const BAND_TIERS = {
  "new-build": [1, 1, 2, 3],
  addition: [1, 1, 2, 3],
  "renovation-remodel": [1, 2, 3, 3],
  inspection: [1, 2, 3, 3],
  repair: [1, 2, 3, 3],
  installation: [1, 2, 3, 3],
  maintenance: [1, 2, 3, 3],
} as const;

const BANDS = [
  "UNDER_5K",
  "BETWEEN_5K_15K",
  "BETWEEN_15K_50K",
  "OVER_50K",
] as const;

export type OperationalCounts = {
  leads: number;
  matches: number;
  successFees: number;
  confirmations: number;
  followUpTokens: number;
  walletTransactions: number;
};

async function operationalCounts(db: PrismaClient): Promise<OperationalCounts> {
  const [leads, matches, successFees, confirmations, followUpTokens, walletTransactions] =
    await Promise.all([
      db.lead.count(),
      db.leadMatch.count(),
      db.successFee.count(),
      db.landownerConfirmation.count(),
      db.followUpToken.count(),
      db.walletTransaction.count(),
    ]);
  return { leads, matches, successFees, confirmations, followUpTokens, walletTransactions };
}

function assertOperationallyEmpty(counts: OperationalCounts) {
  if (Object.values(counts).some((count) => count !== 0)) {
    throw new Error("Production bootstrap refused: operational tables are not empty.");
  }
}

async function assertProductionTarget() {
  if (process.env.LANDYS_ENV !== "production" || process.env.NODE_ENV !== "production") {
    throw new Error("Production bootstrap refused: runtime is not Production.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Production bootstrap refused: DATABASE_URL is missing.");
  const host = new URL(databaseUrl).hostname.toLowerCase();
  if (host.includes("supabase")) {
    throw new Error("Production bootstrap refused: Supabase database detected.");
  }
  const [identity] = await prisma.$queryRaw<Array<{ databaseName: string; serverAddress: string | null }>>(
    Prisma.sql`SELECT current_database() AS "databaseName", inet_server_addr()::text AS "serverAddress"`,
  );
  if (identity?.databaseName !== "neondb" || !identity.serverAddress) {
    throw new Error("Production bootstrap refused: native Replit Production database not detected.");
  }
}

export async function bootstrapProductionReferenceData() {
  await assertProductionTarget();
  const before = await operationalCounts(prisma);
  assertOperationallyEmpty(before);

  await prisma.$transaction(async (tx) => {
    for (const [id, name, code] of CATEGORIES) {
      await tx.contractorCategory.upsert({
        where: { code },
        update: { name, archivedAt: null, isActiveForNewIntake: true },
        create: { id, name, code, isActiveForNewIntake: true },
      });
    }
    for (const [id, name, code] of WORK_TYPES) {
      await tx.workType.upsert({
        where: { code },
        update: { name, archivedAt: null, isActiveForNewIntake: true },
        create: { id, name, code, isActiveForNewIntake: true },
      });
    }
    for (const [id, name, code] of LAND_TYPES) {
      await tx.landType.upsert({
        where: { code },
        update: { name, archivedAt: null, isActiveForNewIntake: true },
        create: { id, name, code, isActiveForNewIntake: true },
      });
    }
    for (const [name, code] of PROJECTS) {
      const routingId = `ctype_${code.replaceAll("-", "_")}`;
      const projectId = `ptype_${code.replaceAll("-", "_")}`;
      const routing = await tx.contractorType.upsert({
        where: { name },
        update: {},
        create: { id: routingId, name },
      });
      await tx.projectType.upsert({
        where: { code },
        update: { name },
        create: {
          id: projectId,
          name,
          code,
          contractorTypeId: routing.id,
          archivedAt: new Date(),
        },
      });
    }
    for (const [key, value] of SETTINGS) {
      await tx.appSetting.upsert({
        where: { key },
        update: {},
        create: { key, value },
      });
    }
    for (const tier of [
      { id: "sft_small", sortOrder: 1, maxValueCents: 999_999, rateBasisPoints: 500 },
      { id: "sft_medium", sortOrder: 2, maxValueCents: 2_499_999, rateBasisPoints: 400 },
      { id: "sft_large", sortOrder: 3, maxValueCents: null, rateBasisPoints: 300 },
    ]) {
      await tx.successFeeTier.upsert({
        where: { sortOrder: tier.sortOrder },
        update: {},
        create: tier,
      });
    }
    for (const [workCode, tiers] of Object.entries(BAND_TIERS)) {
      const workType = await tx.workType.findUniqueOrThrow({ where: { code: workCode } });
      for (const [index, budgetBand] of BANDS.entries()) {
        await tx.budgetBandTierMapping.upsert({
          where: { workTypeId_budgetBand: { workTypeId: workType.id, budgetBand } },
          update: {},
          create: {
            id: `bbtm_${workCode}_${budgetBand.toLowerCase()}`,
            workTypeId: workType.id,
            budgetBand,
            tier: tiers[index],
          },
        });
      }
    }
  });

  const after = await operationalCounts(prisma);
  assertOperationallyEmpty(after);
  const [projects, services, landTypes, categories, successFeeTiers, appSettings, mappings] =
    await Promise.all([
      prisma.projectType.count({ where: { code: { in: PROJECTS.map(([, code]) => code) } } }),
      prisma.workType.count({ where: { code: { in: WORK_TYPES.map(([, , code]) => code) } } }),
      prisma.landType.count({ where: { code: { in: LAND_TYPES.map(([, , code]) => code) } } }),
      prisma.contractorCategory.count({
        where: { code: { in: CATEGORIES.map(([, , code]) => code) } },
      }),
      prisma.successFeeTier.count(),
      prisma.appSetting.count({ where: { key: { in: SETTINGS.map(([key]) => key) } } }),
      prisma.budgetBandTierMapping.count(),
    ]);

  return {
    reference: { projects, services, landTypes, categories, successFeeTiers, appSettings, mappings },
    operational: after,
  };
}
