import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { WixEstimateAttachment } from "@/lib/integrations/wix/estimate-contract";
import {
  downloadAndStoreAttachment,
  LEAD_ATTACHMENTS_BUCKET,
} from "@/lib/integrations/attachments/downloader";

export const MAX_ATTACHMENTS_PER_LEAD = 5;

export type AttachmentIngestionResult = {
  ingested: number;
  failed: number;
  hasFailures: boolean;
};

export async function ingestLeadAttachments(params: {
  leadId: string;
  attachments: WixEstimateAttachment[];
}): Promise<AttachmentIngestionResult> {
  if (params.attachments.length === 0) {
    return { ingested: 0, failed: 0, hasFailures: false };
  }

  const slice = params.attachments.slice(0, MAX_ATTACHMENTS_PER_LEAD);
  let ingested = 0;
  let failed = 0;

  for (const attachment of slice) {
    const existing = await prisma.leadAttachment.findFirst({
      where: { leadId: params.leadId, sourceUrl: attachment.downloadUrl },
    });
    if (existing && !existing.ingestionError && existing.storageKey.startsWith("leads/")) {
      ingested += 1;
      continue;
    }

    try {
      const stored = await downloadAndStoreAttachment(attachment);
      const checksum = createHash("sha256").update(stored.bytes).digest("hex");
      if (existing) {
        await prisma.leadAttachment.update({
          where: { id: existing.id },
          data: {
            storageProvider: "app-storage",
            storageKey: stored.storageKey,
            originalFilename: stored.filename,
            contentType: stored.contentType,
            sizeBytes: stored.bytes.length,
            checksumSha256: checksum,
            ingestionError: null,
            sourceUrl: attachment.downloadUrl,
          },
        });
      } else {
        await prisma.leadAttachment.create({
          data: {
            leadId: params.leadId,
            storageProvider: "app-storage",
            storageKey: stored.storageKey,
            originalFilename: stored.filename,
            contentType: stored.contentType,
            sizeBytes: stored.bytes.length,
            checksumSha256: checksum,
            sourceUrl: attachment.downloadUrl,
          },
        });
      }
      ingested += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Attachment ingestion failed.";
      if (existing) {
        await prisma.leadAttachment.update({
          where: { id: existing.id },
          data: { ingestionError: message },
        });
      } else {
        await prisma.leadAttachment.create({
          data: {
            leadId: params.leadId,
            storageProvider: "app-storage",
            storageKey: `failed/${params.leadId}/${Date.now()}`,
            originalFilename: attachment.fileName,
            contentType: attachment.mimeType ?? "application/octet-stream",
            sizeBytes: attachment.sizeBytes ?? 0,
            ingestionError: message,
            sourceUrl: attachment.downloadUrl,
          },
        });
      }
      await prisma.auditLog.create({
        data: {
          actorType: "system",
          action: "lead.attachment.ingestion_failed",
          targetType: "Lead",
          targetId: params.leadId,
          metadata: { fileName: attachment.fileName, error: message },
        },
      });
    }
  }

  return { ingested, failed, hasFailures: failed > 0 };
}

export { LEAD_ATTACHMENTS_BUCKET };
