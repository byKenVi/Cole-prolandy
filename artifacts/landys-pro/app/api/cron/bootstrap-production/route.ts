import { NextResponse, type NextRequest } from "next/server";
import { bootstrapProductionReferenceData } from "@/lib/ops/production-reference-bootstrap";
import { runWixContractorSync } from "@/lib/integrations/wix/contractor-sync";
import { prisma } from "@/lib/prisma";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ ok: false }, { status: 401 });

  try {
    const bootstrap = await bootstrapProductionReferenceData();
    const wix = await runWixContractorSync({ incremental: false });
    const [active, inactive, wixIdsAvailable] = await Promise.all([
      prisma.contractor.count({ where: { deactivatedAt: null } }),
      prisma.contractor.count({ where: { deactivatedAt: { not: null } } }),
      prisma.externalContractorIdentity.count({ where: { source: "wix" } }),
    ]);
    return NextResponse.json({
      ok: true,
      bootstrap,
      contractors: {
        synced: active + inactive,
        active,
        inactive,
        wixIdsAvailable,
      },
      wix: {
        fetched: wix.fetched,
        created: wix.created,
        updated: wix.updated,
        unchanged: wix.unchanged,
        invalidIdentity: wix.invalidIdentity,
        errors: wix.errors,
      },
    });
  } catch (error) {
    console.error("[bootstrap-production] failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Bootstrap failed." },
      { status: 500 },
    );
  }
}