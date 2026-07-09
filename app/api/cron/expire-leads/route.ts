import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireLeads } from "@/lib/domain/leads";

/**
 * Lead expiry sweep. Wire to a Vercel Cron (see vercel.json). This is a mutating
 * GET, so it MUST be protected in production: CRON_SECRET is REQUIRED in prod and
 * the request must send it as a Bearer token. If CRON_SECRET is unset in prod the
 * endpoint fails closed (401). In development it stays open when unset.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !secret) {
    // Fail closed: never expose a public mutating endpoint in production.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const res = await expireLeads(prisma);
  return NextResponse.json({ ok: true, ...res });
}
