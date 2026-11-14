import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getContractorLeadAttachmentDownload } from "@/lib/services/lead-attachment-access";

/**
 * Photos for contractors who accepted from the text-message link (no account).
 * The accept token identifies the contractor; photos stay hidden until accepted.
 */
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string; attachmentId: string }> },
) {
  const { token, attachmentId } = await context.params;
  const match = await prisma.leadMatch.findUnique({
    where: { acceptToken: token },
    select: { contractorId: true, leadId: true, status: true },
  });
  if (!match || match.status !== "ACCEPTED") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }
  const result = await getContractorLeadAttachmentDownload({
    contractorId: match.contractorId,
    leadId: match.leadId,
    attachmentId,
  });
  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 503;
    return NextResponse.json({ ok: false, error: result.code }, { status });
  }
  return NextResponse.redirect(result.signedUrl, 302);
}
