import { NextResponse, type NextRequest } from "next/server";
import { runWixContractorSync } from "@/lib/integrations/wix/contractor-sync";

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";
  if (isProd && !secret) return false;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Scheduled Wix contractor sync — protected by CRON_SECRET in production. */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const summary = await runWixContractorSync({ incremental: true });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[wix-contractor-sync] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sync failed.",
      },
      { status: 500 },
    );
  }
}
