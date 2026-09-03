/**
 * Local Supabase DEV database lifecycle.
 *
 *   pnpm local:migrate     # migrate + mark environmentName=local
 *   pnpm local:reset       # wipe operational QA data (marked local DB only)
 *   pnpm local:seed        # seed success-fee fixtures (marked local DB only)
 *   pnpm local:reseed      # reset + seed
 *
 * Never targets production. Requires LANDYS_ENV=local and a safe DB URL.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  assertLocalSupabaseIsolation,
  assertNotProductionTarget,
} from "../lib/ops/database-safety";
import {
  clearOperationalQaData,
  seedSuccessFeeQaFixtures,
} from "../lib/ops/success-fee-qa-seed";
import { ensureLocalClerkQaUsers } from "./local-clerk-qa";

const command = process.argv[2];
const LOCAL_MARKER_KEY = "environmentName";
const LOCAL_MARKER_VALUE = "local";
const appRoot = fileURLToPath(new URL("../", import.meta.url));

function configureLocalEnvironment() {
  assertNotProductionTarget({
    landysEnv: process.env.LANDYS_ENV ?? "",
    allowEnv: ["local"],
    publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  });

  if (process.env.LANDYS_ENV !== "local") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "local".');
  }

  // Root .env is the canonical secret source. LOCAL_* aliases remain a
  // fallback for older clones, never a higher-priority override.
  const runtimeUrl =
    process.env.DATABASE_URL?.trim() || process.env.LOCAL_DATABASE_URL?.trim();
  const directUrl =
    process.env.DIRECT_URL?.trim() ||
    process.env.LOCAL_DIRECT_URL?.trim() ||
    runtimeUrl;
  const expectedProjectRef = process.env.LOCAL_SUPABASE_PROJECT_REF?.trim();

  if (!runtimeUrl || !directUrl || !expectedProjectRef) {
    throw new Error(
      "Refusing: DATABASE_URL, DIRECT_URL, and LOCAL_SUPABASE_PROJECT_REF are required for local QA.",
    );
  }

  assertLocalSupabaseIsolation({
    databaseUrl: runtimeUrl,
    directUrl,
    expectedProjectRef,
    supabaseUrl: process.env.SUPABASE_URL,
  });

  assertNotProductionTarget({
    landysEnv: "local",
    databaseUrl: runtimeUrl,
    expectedSupabaseProjectRef: expectedProjectRef,
    publicUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    allowEnv: ["local"],
  });

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
  if (appTableCount === 0) return { empty: true, markedLocal: false };

  const marker = await db.appSetting.findUnique({ where: { key: LOCAL_MARKER_KEY } });
  return { empty: false, markedLocal: marker?.value === LOCAL_MARKER_VALUE };
}

async function assertMarkedLocal(db: PrismaClient) {
  const marker = await db.appSetting.findUnique({ where: { key: LOCAL_MARKER_KEY } });
  if (marker?.value !== LOCAL_MARKER_VALUE) {
    throw new Error(
      'Refusing destructive command: database is not marked as local (AppSetting environmentName=local). Run local:migrate first.',
    );
  }
}

async function migrate() {
  const before = await client();
  try {
    const state = await inspectDatabase(before);
    if (!state.empty && !state.markedLocal) {
      throw new Error(
        "Refusing migration: database already contains Landy's Pro tables but is not marked local. " +
          "Use the dedicated disposable Supabase DEV database.",
      );
    }
  } finally {
    await before.$disconnect();
  }

  const prismaCli = path.join(appRoot, "node_modules", "prisma", "build", "index.js");
  const schema = path.join(appRoot, "prisma", "schema.prisma");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], {
    stdio: "inherit",
    env: process.env,
    cwd: appRoot,
  });
  if (result.status !== 0) throw new Error("prisma migrate deploy failed.");

  const after = await client();
  try {
    await after.appSetting.upsert({
      where: { key: LOCAL_MARKER_KEY },
      create: { key: LOCAL_MARKER_KEY, value: LOCAL_MARKER_VALUE },
      update: { value: LOCAL_MARKER_VALUE },
    });
    console.log("✓ Local migrations applied. Marker environmentName=local set.");
  } finally {
    await after.$disconnect();
  }
}

async function reset(db: PrismaClient) {
  await assertMarkedLocal(db);
  await clearOperationalQaData(db);
  console.log("✓ Local operational data cleared (contractors/admins wiped for reseed).");
}

async function seed(db: PrismaClient, clerkIds?: { adminUserId: string; contractorUserId: string }) {
  await assertMarkedLocal(db);

  // Local Cursor QA prefers dedicated LOCAL_* addresses over production bootstrap emails.
  const adminEmail =
    process.env.LOCAL_ADMIN_EMAIL?.trim().toLowerCase() ||
    process.env.ADMIN_EMAILS?.split(",")[0]?.trim().toLowerCase() ||
    "admin@localhost.test";

  const contractorEmails = (
    process.env.LOCAL_CONTRACTOR_EMAILS ??
    "contractor1@localhost.test,contractor2@localhost.test,contractor3@localhost.test,contractor4@localhost.test"
  )
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);

  await seedSuccessFeeQaFixtures(db, {
    environmentName: "local",
    adminEmail,
    adminName: "Local QA Owner",
    contractorEmails,
    idPrefix: "local",
  });

  if (clerkIds) {
    await db.adminUser.updateMany({
      where: { email: { equals: adminEmail, mode: "insensitive" } },
      data: { clerkUserId: clerkIds.adminUserId, role: "OWNER" },
    });
    await db.contractor.updateMany({
      where: { email: { equals: contractorEmails[0]!, mode: "insensitive" } },
      data: { clerkUserId: clerkIds.contractorUserId },
    });
    console.log("✓ Linked Clerk TEST QA users to Admin + primary Contractor.");
  }

  console.log("✓ Local success-fee QA fixtures seeded.");
  console.log(`  Admin: ${adminEmail}`);
  console.log(`  Contractors: ${contractorEmails.slice(0, 4).join(", ")}`);

  const forbiddenCounts = await db.$queryRaw<
    Array<{ wallet_transactions: bigint; price_tiers: bigint; work_type_price_tiers: bigint }>
  >`
    SELECT
      (SELECT COUNT(*) FROM "WalletTransaction")::bigint AS wallet_transactions,
      (SELECT COUNT(*) FROM "PriceTier")::bigint AS price_tiers,
      (SELECT COUNT(*) FROM "WorkTypePriceTier")::bigint AS work_type_price_tiers
  `;
  const counts = forbiddenCounts[0];
  if (
    Number(counts?.wallet_transactions ?? 0) !== 0 ||
    Number(counts?.price_tiers ?? 0) !== 0 ||
    Number(counts?.work_type_price_tiers ?? 0) !== 0
  ) {
    throw new Error("Local seed verification failed: retired pay-per-lead data exists.");
  }
  console.log("✓ Verified: no wallet transactions or retired lead-pricing fixtures.");
}

async function verify(db: PrismaClient) {
  await assertMarkedLocal(db);
  const [contractors, leads, matches, successFees, confirmations, walletTransactions, priceTiers, workTypePriceTiers, latestWixLead] =
    await Promise.all([
      db.contractor.count({ where: { deactivatedAt: null } }),
      db.lead.count(),
      db.leadMatch.count(),
      db.successFee.groupBy({ by: ["status"], _count: { _all: true } }),
      db.landownerConfirmation.count(),
      db.walletTransaction.count(),
      db.priceTier.count(),
      db.workTypePriceTier.count(),
      db.lead.findFirst({
        where: { source: "wix" },
        orderBy: { createdAt: "desc" },
        select: { reviewStatus: true, _count: { select: { matches: true } } },
      }),
    ]);

  console.log(JSON.stringify({
    environment: "local",
    contractors,
    leads,
    matches,
    successFees: Object.fromEntries(successFees.map((row) => [row.status, row._count._all])),
    confirmations,
    retiredData: { walletTransactions, priceTiers, workTypePriceTiers },
    latestWixLead: latestWixLead
      ? { reviewStatus: latestWixLead.reviewStatus, matches: latestWixLead._count.matches }
      : null,
  }, null, 2));
}

async function main() {
  configureLocalEnvironment();
  if (command === "migrate") return migrate();

  if (command === "reseed") {
    await migrate();

    let clerkIds: { adminUserId: string; contractorUserId: string } | undefined;
    if (process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) {
      const clerk = await ensureLocalClerkQaUsers();
      console.log("✓ Clerk TEST QA users ensured (no duplicates).");
      console.log(`  Admin: ${clerk.adminEmail}`);
      console.log(`  Contractor: ${clerk.contractorEmail}`);
      clerkIds = {
        adminUserId: clerk.adminUserId,
        contractorUserId: clerk.contractorUserId,
      };
    } else {
      console.warn("⚠ Skipping Clerk QA provision — CLERK_SECRET_KEY is not sk_test_.");
    }

    const resetClient = await client();
    try {
      await reset(resetClient);
    } finally {
      await resetClient.$disconnect();
    }

    // Reconnect after the large reset transaction. This avoids reusing a
    // stale pooled connection before beginning the seed transaction.
    const seedClient = await client();
    try {
      return seed(seedClient, clerkIds);
    } finally {
      await seedClient.$disconnect();
    }
  }

  const db = await client();
  try {
    if (command === "reset") return reset(db);
    if (command === "seed") return seed(db);
    if (command === "verify") return verify(db);
    throw new Error("Usage: local-database.ts <migrate|reset|seed|reseed|verify>");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
