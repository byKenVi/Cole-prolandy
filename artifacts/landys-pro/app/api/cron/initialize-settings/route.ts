import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const REQUIRED_SETTINGS = [
  { key: "maxLeadPurchases", value: "3" },
  { key: "leadExpiryHours", value: "48" },
  { key: "acceptanceUnlimited", value: "false" },
  { key: "followUpOutcomeDelayHours", value: "72" },
  { key: "followUpPaymentDelayHours", value: "336" },
  { key: "followUpPaymentRetryHours", value: "168" },
] as const;

const SUCCESS_FEE_TIERS = [
  { id: "sft_small", sortOrder: 1, maxValueCents: 999_999, rateBasisPoints: 500 },
  { id: "sft_medium", sortOrder: 2, maxValueCents: 2_499_999, rateBasisPoints: 400 },
  { id: "sft_large", sortOrder: 3, maxValueCents: null, rateBasisPoints: 300 },
] as const;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

async function assertProductionTarget() {
  if (process.env.LANDYS_ENV !== "production" || process.env.NODE_ENV !== "production") {
    throw new Error("Settings initialization refused outside Production.");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || new URL(databaseUrl).hostname.toLowerCase().includes("supabase")) {
    throw new Error("Settings initialization refused for this database target.");
  }

  const [identity] = await prisma.$queryRaw<Array<{ databaseName: string }>>(
    Prisma.sql`SELECT current_database() AS "databaseName"`,
  );
  if (identity?.databaseName !== "neondb") {
    throw new Error("Settings initialization refused: Production database not detected.");
  }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    await assertProductionTarget();

    const result = await prisma.$transaction(async (tx) => {
      const insertedSettings: string[] = [];
      for (const setting of REQUIRED_SETTINGS) {
        const inserted = await tx.appSetting.createMany({
          data: [setting],
          skipDuplicates: true,
        });
        if (inserted.count === 1) insertedSettings.push(setting.key);
      }

      const insertedTiers: number[] = [];
      for (const tier of SUCCESS_FEE_TIERS) {
        const inserted = await tx.successFeeTier.createMany({
          data: [tier],
          skipDuplicates: true,
        });
        if (inserted.count === 1) insertedTiers.push(tier.sortOrder);
      }

      const [settings, tiers] = await Promise.all([
        tx.appSetting.findMany({
          where: { key: { in: REQUIRED_SETTINGS.map((setting) => setting.key) } },
          orderBy: { key: "asc" },
          select: { key: true, value: true },
        }),
        tx.successFeeTier.findMany({
          orderBy: { sortOrder: "asc" },
          select: {
            sortOrder: true,
            maxValueCents: true,
            rateBasisPoints: true,
          },
        }),
      ]);

      return { insertedSettings, insertedTiers, settings, tiers };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Production Settings initialization failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}