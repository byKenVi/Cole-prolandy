import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Lightweight endpoint used by the invite acceptance page to detect whether
 * the current browser session is authenticated. Returns 200 when signed in,
 * 401 otherwise.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true });
}
