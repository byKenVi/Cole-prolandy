import { NextResponse } from "next/server";
import { getAppObjectDownloadUrl } from "@/lib/replit-object-storage";

export async function GET(
  _request: Request,
  context: { params: Promise<{ contractorId: string; filename: string }> },
) {
  const { contractorId, filename } = await context.params;
  if (
    !/^[a-zA-Z0-9_-]+$/.test(contractorId) ||
    !/^[a-zA-Z0-9._-]+$/.test(filename)
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    const signedUrl = await getAppObjectDownloadUrl(
      `contractor-logos/${contractorId}/${filename}`,
      300,
    );
    return NextResponse.redirect(signedUrl, 302);
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}