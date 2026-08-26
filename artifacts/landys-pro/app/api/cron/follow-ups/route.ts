import { NextResponse, type NextRequest } from "next/server";
import { dispatchDueFollowUps } from "@/lib/domain/landowner-confirm";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (isProd && !secret) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const res = await dispatchDueFollowUps();
  return NextResponse.json({ ok: true, ...res });
}
