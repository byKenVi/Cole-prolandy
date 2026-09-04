/**
 * Native Replit Development database lifecycle.
 *
 * Refuses Supabase and production-like targets. Reset/reseed also requires an
 * existing AppSetting(environmentName=development) marker.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import {
  clearOperationalQaData,
  seedSuccessFeeQaFixtures,
} from "../lib/ops/success-fee-qa-seed";

const command = process.argv[2];
const appRoot = fileURLToPath(new URL("../", import.meta.url));
const MARKER_KEY = "environmentName";
const MARKER_VALUE = "development";

function assertDevelopmentDatabase(): string {
  if ((process.env.LANDYS_ENV ?? "development") !== "development") {
    throw new Error('Refusing: LANDYS_ENV must be exactly "development".');
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("Refusing: DATABASE_URL is required.");
  const parsed = new URL(databaseUrl);
  const host = parsed.hostname.toLowerCase();
  const username = decodeURIComponent(parsed.username).toLowerCase();
  if (
    host.includes("supabase") ||
    username.includes("lifmdxzaytzotnfsaqtr") ||
    host.includes("production") ||
    host.includes("cole-prolandy")
  ) {
    throw new Error("Refusing: database target is external or production-like.");
  }
  return databaseUrl;
}

async function client(): Promise<PrismaClient> {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient();
}

async function marker(db: PrismaClient): Promise<string | null> {
  return (await db.appSetting.findUnique({ where: { key: MARKER_KEY } }))?.value ?? null;
}

async function assertMarkedDevelopment(db: PrismaClient) {
  if ((await marker(db)) !== MARKER_VALUE) {
    throw new Error(
      "Refusing destructive command: database is not marked environmentName=development.",
    );
  }
}

async function migrate() {
  const prismaCli = path.join(appRoot, "node_modules", "prisma", "build", "index.js");
  const schema = path.join(appRoot, "prisma", "schema.prisma");
  const result = spawnSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schema], {
    stdio: "inherit",
    env: process.env,
    cwd: appRoot,
  });
  if (result.status !== 0) throw new Error("prisma migrate deploy failed.");

  const db = await client();
  try {
    const [contractors, leads, admins] = await Promise.all([
      db.contractor.count(),
      db.lead.count(),
      db.adminUser.count(),
    ]);
    const currentMarker = await marker(db);
    if (
      currentMarker !== MARKER_VALUE &&
      (contractors !== 0 || leads !== 0 || admins !== 0)
    ) {
      throw new Error("Refusing to mark a non-empty database as Development.");
    }
    await db.appSetting.upsert({
      where: { key: MARKER_KEY },
      create: { key: MARKER_KEY, value: MARKER_VALUE },
      update: { value: MARKER_VALUE },
    });
    console.log("Development migrations applied and environment marker verified.");
  } finally {
    await db.$disconnect();
  }
}

function qaIdentities() {
  const adminEmail = process.env.DEVELOPMENT_ADMIN_EMAIL?.trim().toLowerCase();
  const contractorEmails = (process.env.DEVELOPMENT_CONTRACTOR_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!adminEmail || contractorEmails.length < 4) {
    throw new Error(
      "DEVELOPMENT_ADMIN_EMAIL and at least four DEVELOPMENT_CONTRACTOR_EMAILS are required.",
    );
  }
  return { adminEmail, contractorEmails };
}

async function reset(db: PrismaClient) {
  await assertMarkedDevelopment(db);
  await clearOperationalQaData(db);
  console.log("Development operational QA data cleared.");
}

async function seed(db: PrismaClient) {
  await assertMarkedDevelopment(db);
  const { adminEmail, contractorEmails } = qaIdentities();
  await seedSuccessFeeQaFixtures(db, {
    environmentName: "development",
    adminEmail,
    adminName: "Development QA Owner",
    contractorEmails,
    idPrefix: "dev",
  });

  const [walletTransactions, priceTiers, workTypePriceTiers] = await Promise.all([
    db.walletTransaction.count(),
    db.priceTier.count(),
    db.workTypePriceTier.count(),
  ]);
  if (walletTransactions || priceTiers || workTypePriceTiers) {
    throw new Error("Development seed verification failed: retired pricing data exists.");
  }
  console.log("Development success-fee QA fixtures seeded and verified.");
}

async function verify(db: PrismaClient) {
  await assertMarkedDevelopment(db);
  const [contractors, leads, matches, fees, confirmations, wallets, priceTiers] =
    await Promise.all([
      db.contractor.count({ where: { deactivatedAt: null } }),
      db.lead.count(),
      db.leadMatch.count(),
      db.successFee.groupBy({ by: ["status"], _count: { _all: true } }),
      db.landownerConfirmation.count(),
      db.walletTransaction.count(),
      db.priceTier.count(),
    ]);
  console.log(
    JSON.stringify(
      {
        environment: MARKER_VALUE,
        contractors,
        leads,
        matches,
        successFees: Object.fromEntries(fees.map((row) => [row.status, row._count._all])),
        confirmations,
        retiredData: { walletTransactions: wallets, priceTiers },
      },
      null,
      2,
    ),
  );
}

async function main() {
  assertDevelopmentDatabase();
  if (command === "migrate") return migrate();
  if (command === "reseed") {
    await migrate();
    const resetClient = await client();
    try {
      await reset(resetClient);
    } finally {
      await resetClient.$disconnect();
    }
    const seedClient = await client();
    try {
      return seed(seedClient);
    } finally {
      await seedClient.$disconnect();
    }
  }

  const db = await client();
  try {
    if (command === "reset") return reset(db);
    if (command === "seed") return seed(db);
    if (command === "verify") return verify(db);
    throw new Error(
      "Usage: development-database.ts <migrate|reset|seed|reseed|verify>",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});