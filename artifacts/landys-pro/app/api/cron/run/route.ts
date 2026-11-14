import { NextResponse, type NextRequest } from "next/server";
import { hasBearer } from "@/lib/security/bearer";
import { runScheduledJobs } from "@/lib/services/scheduled-jobs";

/**
 * Single scheduler entry point. Call every 10 minutes from an external cron
 * (cron-job.org) with `Authorization: Bearer <CRON_SECRET>`.
 * Runs: lead expiry, contractor follow-ups, fee reminders, landowner
 * "did you hire?" emails, scheduled invitations, Wix sync, outbox dispatch.
 */
export const dynamic = "force-dynamic";

async function handle(req: NextRequest) {
  if (!hasBearer(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const result = await runScheduledJobs();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron] run failed", error);
    return NextResponse.json({ ok: false, error: "Scheduled run failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
