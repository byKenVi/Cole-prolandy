import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";

/**
 * Lead expiry sweep. Wire to a Vercel Cron (see vercel.json). Optionally protect
 * with CRON_SECRET: set it in env and Vercel sends it as a Bearer token.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }
  const res = await expireLeads(prisma);
  return NextResponse.json({ ok: true, ...res });
}
