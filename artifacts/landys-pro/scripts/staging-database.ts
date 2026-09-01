/**
 * Staging database lifecycle.
 *
 * Commands:
 *   pnpm staging:migrate  # empty DB or already-marked staging DB only
 *   pnpm staging:reset    # marked staging DB only; removes staging data
 *   pnpm staging:reseed   # reset + canonical current-model fixtures
 *
 * These commands NEVER use DATABASE_URL implicitly. They require the dedicated
 * STAGING_DATABASE_URL / STAGING_DIRECT_URL secrets and a staging database
 * marker before destructive work.
 */
import { spawnSync } from "node:child_process";
import type { PrismaClient } from "@prisma/client";

const command = process.argv[2];
const STAGING_MARKER_KEY = "environmentName";
const STAGING_MARKER_VALUE = "staging";

function configureStagingEnvironment() {
  if (process.env.LANDYS_ENV !== "staging") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "staging".');
  }
  const publicUrl = process.env.STAGING_PUBLIC_URL?.trim();
  if (!publicUrl || !new URL(publicUrl).hostname.toLowerCase().includes("staging")) {
    throw new Error("Refusing: STAGING_PUBLIC_URL must be HTTPS and contain 'staging' in its hostname.");
  }
  const runtimeUrl = process.env.STAGING_DATABASE_URL?.trim();
  const directUrl = process.env.STAGING_DIRECT_URL?.trim();
  if (!runtimeUrl || !directUrl) {
    throw new Error("Refusing: STAGING_DATABASE_URL and STAGING_DIRECT_URL are required.");
  }
  process.env.DATABASE_URL = runtimeUrl;
  process.env.DIRECT_URL = directUrl;
}

async function client(): Promise<PrismaClient> {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function inspectDatabase(db: PrismaClient) {
  const rows = await db.$queryRaw<Array<{ app_table_count: bigint }>>`
    SELECT COUNT(*)::bigint AS app_table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('Contractor', 'Lead', 'AdminUser', 'AppSetting')
  `;
  const appTableCount = Number(rows[0]?.app_table_count ?? 0);
  if (appTableCount === 0) return { empty: true, markedStaging: false };

  const marker = await db.appSetting.findUnique({ where: { key: STAGING_MARKER_KEY } });
  return { empty: false, markedStaging: marker?.value === STAGING_MARKER_VALUE };
}

async function migrate() {
  const before = await client();
  try {
    const state = await inspectDatabase(before);
    if (!state.empty && !state.markedStaging) {
      throw new Error(
        "Refusing migration: database already contains Landy's Pro tables but is not marked staging.",
      );
    }
  } finally {
    await before.$disconnect();
  }

  const result = spawnSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) throw new Error("prisma migrate deploy failed.");

  const after = await client();
  try {
    await after.appSetting.upsert({
      where: { key: STAGING_MARKER_KEY },
      create: { key: STAGING_MARKER_KEY, value: STAGING_MARKER_VALUE },
      update: { value: STAGING_MARKER_VALUE },
    });
  } finally {
    await after.$disconnect();
  }
}

async function assertMarkedStaging(db: PrismaClient) {
  const marker = await db.appSetting.findUnique({ where: { key: STAGING_MARKER_KEY } });
  if (marker?.value !== STAGING_MARKER_VALUE) {
    throw new Error("Refusing destructive command: database is not marked as staging.");
  }
}

async function reset(db: PrismaClient) {
  await assertMarkedStaging(db);
  await db.$transaction(async (tx) => {
    await tx.processedStripeEvent.deleteMany({});
    await tx.auditLog.deleteMany({});
    await tx.followUpToken.deleteMany({});
    await tx.landownerConfirmation.deleteMany({});
    await tx.successFee.deleteMany({});
    await tx.walletTransaction.deleteMany({});
    await tx.leadMatch.deleteMany({});
    await tx.leadAttachment.deleteMany({});
    await tx.lead.deleteMany({});
    await tx.contractorWorkType.deleteMany({});
    await tx.contractorCategoryMembership.deleteMany({});
    await tx.contractorProject.deleteMany({});
    await tx.externalContractorIdentity.deleteMany({});
    await tx.contractor.deleteMany({});
    await tx.adminInvite.deleteMany({});
    await tx.adminUser.updateMany({ data: { invitedById: null } });
    await tx.adminUser.deleteMany({});
    await tx.priceTier.deleteMany({});
    await tx.workTypePriceTier.deleteMany({});
  });
}

const categories = [
  ["general-contractor", "General Contractor"],
  ["roofing", "Roofing"],
  ["plumbing", "Plumbing"],
  ["electrical", "Electrical"],
  ["hvac", "HVAC"],
  ["landscaping", "Landscaping"],
  ["flooring", "Flooring"],
  ["painting", "Painting"],
  ["kitchen-bath", "Kitchen & Bath"],
  ["foundation-concrete", "Foundation & Concrete"],
  ["other", "Other"],
] as const;
const workTypes = [
  ["new-build", "New Build"],
  ["renovation-remodel", "Renovation / Remodel"],
  ["repair", "Repair"],
  ["addition", "Addition"],
  ["installation", "Installation"],
  ["maintenance", "Maintenance"],
  ["inspection", "Inspection"],
] as const;
const landTypes = [
  ["residential", "Residential"],
  ["commercial", "Commercial"],
  ["multi-family", "Multi-family"],
  ["rural-land", "Rural / Land"],
] as const;

async function seed(db: PrismaClient) {
  await assertMarkedStaging(db);
  const adminEmail = process.env.STAGING_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) throw new Error("STAGING_ADMIN_EMAIL is required for staging seed data.");
  const contractorEmails = (process.env.STAGING_CONTRACTOR_EMAILS ??
    "contractor-one@example.com,contractor-two@example.com,contractor-three@example.com")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (contractorEmails.length < 3) {
    throw new Error("STAGING_CONTRACTOR_EMAILS must contain at least three comma-separated emails.");
  }

  await db.$transaction(async (tx) => {
    for (const [code, name] of categories) {
      await tx.contractorCategory.upsert({
        where: { code },
        create: { code, name, isActiveForNewIntake: true },
        update: { name, archivedAt: null, isActiveForNewIntake: true },
      });
    }
    for (const [code, name] of workTypes) {
      await tx.workType.upsert({
        where: { code },
        create: { code, name, isActiveForNewIntake: true },
        update: { name, archivedAt: null, isActiveForNewIntake: true },
      });
    }
    for (const [code, name] of landTypes) {
      await tx.landType.upsert({
        where: { code },
        create: { code, name, isActiveForNewIntake: true },
        update: { name, archivedAt: null, isActiveForNewIntake: true },
      });
    }
    for (const [sortOrder, maxValueCents, rateBasisPoints] of [
      [1, 999_999, 500],
      [2, 2_499_999, 400],
      [3, null, 300],
    ] as const) {
      await tx.successFeeTier.upsert({
        where: { sortOrder },
        create: { sortOrder, maxValueCents, rateBasisPoints },
        update: { maxValueCents, rateBasisPoints },
      });
    }
    for (const [key, value] of [
      ["environmentName", "staging"],
      ["acceptanceUnlimited", "false"],
      ["followUpOutcomeDelayHours", "72"],
      ["followUpPaymentDelayHours", "336"],
      ["followUpPaymentRetryHours", "168"],
    ] as const) {
      await tx.appSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }

    await tx.adminUser.create({
      data: { email: adminEmail, name: "Staging Owner", role: "OWNER" },
    });

    const contractorSpecs = [
      { id: "staging_contractor_1", name: "Staging General Contractor", email: contractorEmails[0], category: "general-contractor", work: "new-build" },
      { id: "staging_contractor_2", name: "Staging Roofing Contractor", email: contractorEmails[1], category: "roofing", work: "repair" },
      { id: "staging_contractor_3", name: "Staging Landscaping Contractor", email: contractorEmails[2], category: "landscaping", work: "maintenance" },
    ];
    for (let index = 0; index < contractorSpecs.length; index += 1) {
      const spec = contractorSpecs[index];
      const category = await tx.contractorCategory.findUniqueOrThrow({ where: { code: spec.category } });
      const workType = await tx.workType.findUniqueOrThrow({ where: { code: spec.work } });
      await tx.contractor.create({
        data: {
          id: spec.id,
          name: spec.name,
          email: spec.email,
          phone: `+1500555000${index + 1}`,
          contractorCategoryId: category.id,
          walletBalanceCents: 0,
          isPro: index === 0,
          categoryMemberships: { create: { categoryId: category.id, isPrimary: true } },
          workTypes: { create: { workTypeId: workType.id } },
        },
      });
    }

    const residential = await tx.landType.findUniqueOrThrow({ where: { code: "residential" } });
    const general = await tx.contractorCategory.findUniqueOrThrow({ where: { code: "general-contractor" } });
    const newBuild = await tx.workType.findUniqueOrThrow({ where: { code: "new-build" } });
    const now = new Date();
    const fixtures = [
      { key: "open", contractorId: "staging_contractor_1", matchStatus: "PENDING", outcome: "OPEN", fee: null },
      { key: "accepted", contractorId: "staging_contractor_1", matchStatus: "ACCEPTED", outcome: "OPEN", fee: null },
      { key: "won-awaiting", contractorId: "staging_contractor_1", matchStatus: "ACCEPTED", outcome: "WON", fee: "AWAITING_CONTRACTOR_PAYMENT" },
      { key: "fee-due", contractorId: "staging_contractor_2", matchStatus: "ACCEPTED", outcome: "WON", fee: "DUE" },
      { key: "fee-paid", contractorId: "staging_contractor_2", matchStatus: "ACCEPTED", outcome: "WON", fee: "PAID" },
      { key: "mismatch", contractorId: "staging_contractor_3", matchStatus: "ACCEPTED", outcome: "OPEN", fee: null },
    ] as const;

    for (const fixture of fixtures) {
      const accepted = fixture.matchStatus === "ACCEPTED";
      const lead = await tx.lead.create({
        data: {
          id: `staging_lead_${fixture.key}`,
          landownerName: `Staging Landowner ${fixture.key}`,
          landownerEmail: "landowner@example.com",
          landownerPhone: "+15005550199",
          propertyLocation: "Staging County, TX",
          propertyZip: "78701",
          description: `Staging ${fixture.key} success-fee fixture`,
          budgetBand: "BETWEEN_15K_50K",
          budgetCents: 20_000_00,
          landTypeId: residential.id,
          contractorCategoryId: general.id,
          workTypeId: newBuild.id,
          tier: 3,
          status: "DISTRIBUTED",
          reviewStatus: "ROUTED",
          tierReviewRequired: false,
          source: "staging_seed",
          externalRequestId: `staging-${fixture.key}`,
          acceptedCount: accepted ? 1 : 0,
          routedAt: now,
          expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      const match = await tx.leadMatch.create({
        data: {
          id: `staging_match_${fixture.key}`,
          leadId: lead.id,
          contractorId: fixture.contractorId,
          status: fixture.matchStatus,
          acceptedAt: accepted ? now : null,
          jobOutcome: fixture.outcome,
          finalContractValueCents: fixture.outcome === "WON" ? 20_000_00 : null,
          outcomeReportedAt: fixture.outcome === "WON" ? now : null,
        },
      });
      if (fixture.fee) {
        await tx.successFee.create({
          data: {
            leadMatchId: match.id,
            finalValueCents: 20_000_00,
            rateBasisPoints: 400,
            feeAmountCents: 800_00,
            status: fixture.fee,
            dueAt: fixture.fee === "DUE" || fixture.fee === "PAID" ? now : null,
            paidAt: fixture.fee === "PAID" ? now : null,
            paymentMethod: fixture.fee === "PAID" ? "stripe_test" : null,
            stripePaymentIntentId: fixture.fee === "PAID" ? "pi_test_staging_seed_paid" : null,
          },
        });
      }
      if (fixture.key === "fee-paid" || fixture.key === "mismatch") {
        await tx.landownerConfirmation.create({
          data: {
            leadId: lead.id,
            token: `staging_confirmation_${fixture.key}`,
            hired: true,
            hiredLeadMatchId: fixture.key === "fee-paid" ? match.id : null,
            respondedAt: now,
            mismatchFlagged: fixture.key === "mismatch",
            mismatchReason: fixture.key === "mismatch" ? "Staging mismatch example" : null,
          },
        });
      }
    }
  });
}

async function main() {
  configureStagingEnvironment();
  if (command === "migrate") return migrate();
  const db = await client();
  try {
    if (command === "reset") return reset(db);
    if (command === "reseed") {
      await reset(db);
      return seed(db);
    }
    throw new Error("Usage: staging-database.ts <migrate|reset|reseed>");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});