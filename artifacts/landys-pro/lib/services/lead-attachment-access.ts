import { LeadMatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAppObjectDownloadUrl } from "@/lib/replit-object-storage";

export async function getContractorLeadAttachmentDownload(params: {
  contractorId: string;
  leadId: string;
  attachmentId: string;
}) {
  const match = await prisma.leadMatch.findFirst({
    where: {
      leadId: params.leadId,
      contractorId: params.contractorId,
      status: LeadMatchStatus.ACCEPTED,
    },
    select: { id: true },
  });
  if (!match) return { ok: false as const, code: "FORBIDDEN" as const };

  const attachment = await prisma.leadAttachment.findFirst({
    where: { id: params.attachmentId, leadId: params.leadId, ingestionError: null },
  });
  if (!attachment || attachment.storageKey.startsWith("failed/")) {
    return { ok: false as const, code: "NOT_FOUND" as const };
  }

  if (attachment.storageProvider !== "app-storage") {
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }
  let signedUrl: string;
  try {
    signedUrl = await getAppObjectDownloadUrl(attachment.storageKey, 300);
  } catch {
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }

  return {
    ok: true as const,
    signedUrl,
    filename: attachment.originalFilename,
    contentType: attachment.contentType,
  };
}
