import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Uptime check for cron-job.org (or any monitor): 200 when the app and the
 * database answer, 503 otherwise. Exposes no data.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "up", ms: Date.now() - startedAt });
  } catch {
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
