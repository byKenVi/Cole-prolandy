import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { runWixContractorSync } from "@/lib/integrations/wix/contractor-sync";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const dryRun = req.nextUrl.searchParams.get("dryRun") === "true";
  try {
    const summary = await runWixContractorSync({ dryRun, incremental: false });
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[wix-contractor-sync] admin sync failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sync failed.",
      },
      { status: 500 },
    );
  }
}
