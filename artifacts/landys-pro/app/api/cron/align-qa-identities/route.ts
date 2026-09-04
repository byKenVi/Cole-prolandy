import { Prisma } from "@prisma/client";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAIL = "kevin.linhounhinto@techma.ca";
const CONTRACTOR_EMAIL = "lihounhintoe@gmail.com";
const OWNER_EMAIL = "cole@mudrockcapital.com";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

async function assertProductionTarget() {
  if (process.env.LANDYS_ENV !== "production" || process.env.NODE_ENV !== "production") {
    throw new Error("Identity alignment refused outside Production.");
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || new URL(databaseUrl).hostname.toLowerCase().includes("supabase")) {
    throw new Error("Identity alignment refused for this database target.");
  }
  const [identity] = await prisma.$queryRaw<Array<{ databaseName: string }>>(
    Prisma.sql`SELECT current_database() AS "databaseName"`,
  );
  if (identity?.databaseName !== "neondb") {
    throw new Error("Identity alignment refused: Production database not detected.");
  }
}

async function ensureQaClerkUser(email: string): Promise<string> {
  const client = await clerkClient();
  const existing = await client.users.getUserList({ emailAddress: [email], limit: 2 });
  if (existing.data.length > 1) {
    throw new Error(`Identity alignment refused: duplicate Clerk users for ${email}.`);
  }
  if (existing.data[0]) return existing.data[0].id;

  const password = process.env.DEVELOPMENT_QA_PASSWORD;
  if (!password) throw new Error("Identity alignment refused: QA password is unavailable.");
  const created = await client.users.createUser({
    emailAddress: [email],
    password,
    skipPasswordChecks: true,
  });
  return created.id;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    await assertProductionTarget();
    const [adminClerkId, contractorClerkId] = await Promise.all([
      ensureQaClerkUser(ADMIN_EMAIL),
      ensureQaClerkUser(CONTRACTOR_EMAIL),
    ]);
    if (adminClerkId === contractorClerkId) {
      throw new Error("Identity alignment refused: QA identities share one Clerk user.");
    }

    const client = await clerkClient();
    const ownerUsers = await client.users.getUserList({ emailAddress: [OWNER_EMAIL], limit: 2 });
    if (ownerUsers.data.length > 1) {
      throw new Error("Identity alignment refused: duplicate Clerk users for the Owner.");
    }
    const ownerClerkId = ownerUsers.data[0]?.id ?? null;

    await prisma.$transaction(async (tx) => {
      await tx.adminUser.updateMany({
        where: { email: { equals: CONTRACTOR_EMAIL, mode: "insensitive" } },
        data: { clerkUserId: null, disabledAt: new Date() },
      });

      await tx.adminUser.upsert({
        where: { email: ADMIN_EMAIL },
        update: { role: "OWNER", clerkUserId: adminClerkId, disabledAt: null },
        create: {
          email: ADMIN_EMAIL,
          name: "Kevin",
          role: "OWNER",
          clerkUserId: adminClerkId,
        },
      });

      await tx.adminUser.upsert({
        where: { email: OWNER_EMAIL },
        update: { role: "OWNER", disabledAt: null, ...(ownerClerkId ? { clerkUserId: ownerClerkId } : {}) },
        create: {
          email: OWNER_EMAIL,
          name: "Cole",
          role: "OWNER",
          clerkUserId: ownerClerkId,
        },
      });

      await tx.contractor.upsert({
        where: { email: CONTRACTOR_EMAIL },
        update: {
          name: "TECHMA QA Contractor",
          phone: "+15555550123",
          clerkUserId: contractorClerkId,
          deactivatedAt: null,
        },
        create: {
          id: "qa_contractor_lihounhintoe",
          name: "TECHMA QA Contractor",
          email: CONTRACTOR_EMAIL,
          phone: "+15555550123",
          clerkUserId: contractorClerkId,
        },
      });
    });

    const [admin, contractor, owner, conflicts] = await Promise.all([
      prisma.adminUser.findUnique({
        where: { email: ADMIN_EMAIL },
        select: { role: true, clerkUserId: true, disabledAt: true },
      }),
      prisma.contractor.findUnique({
        where: { email: CONTRACTOR_EMAIL },
        select: { clerkUserId: true, deactivatedAt: true },
      }),
      prisma.adminUser.findUnique({
        where: { email: OWNER_EMAIL },
        select: { role: true, clerkUserId: true, disabledAt: true },
      }),
      prisma.adminUser.count({ where: { clerkUserId: contractorClerkId } }),
    ]);
    if (conflicts !== 0) {
      throw new Error("Identity alignment failed: contractor Clerk user still has Admin linkage.");
    }

    return NextResponse.json({
      ok: true,
      admin: {
        linked: admin?.clerkUserId === adminClerkId,
        owner: admin?.role === "OWNER",
        enabled: admin?.disabledAt === null,
      },
      contractor: {
        linked: contractor?.clerkUserId === contractorClerkId,
        enabled: contractor?.deactivatedAt === null,
        adminLinks: conflicts,
      },
      cole: {
        owner: owner?.role === "OWNER",
        enabled: owner?.disabledAt === null,
        explicitClerkLink: Boolean(owner?.clerkUserId),
        bootstrapPreserved: true,
      },
    });
  } catch (error) {
    console.error("[align-qa-identities] failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Identity alignment failed." },
      { status: 500 },
    );
  }
}