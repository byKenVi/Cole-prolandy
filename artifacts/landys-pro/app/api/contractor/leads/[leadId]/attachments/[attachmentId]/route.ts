import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getContractorLeadAttachmentDownload } from "@/lib/services/lead-attachment-access";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ leadId: string; attachmentId: string }> },
) {
  const session = await getSession();
  if (!session.contractorId) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const { leadId, attachmentId } = await context.params;
  const result = await getContractorLeadAttachmentDownload({
    contractorId: session.contractorId,
    leadId,
    attachmentId,
  });

  if (!result.ok) {
    const status = result.code === "FORBIDDEN" ? 403 : result.code === "NOT_FOUND" ? 404 : 503;
    return NextResponse.json({ ok: false, error: result.code }, { status });
  }

  return NextResponse.redirect(result.signedUrl, 302);
}
