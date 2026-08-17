import { LeadMatchStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStorageAdmin } from "@/lib/supabase-storage";
import { LEAD_ATTACHMENTS_BUCKET } from "@/lib/services/lead-attachments";

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

  const storage = getStorageAdmin();
  if (!storage) return { ok: false as const, code: "UNAVAILABLE" as const };

  const { data, error } = await storage.storage
    .from(LEAD_ATTACHMENTS_BUCKET)
    .createSignedUrl(attachment.storageKey, 300);
  if (error || !data?.signedUrl) {
    return { ok: false as const, code: "UNAVAILABLE" as const };
  }

  return {
    ok: true as const,
    signedUrl: data.signedUrl,
    filename: attachment.originalFilename,
    contentType: attachment.contentType,
  };
}
