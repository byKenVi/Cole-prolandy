-- Internal attachment metadata only. No upload or Wix transport is enabled by
-- this migration. Storage objects must remain private and are registered only
-- by a future reviewed ingestion service.
CREATE TABLE "LeadAttachment" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalFilename" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeadAttachment_sizeBytes_nonnegative" CHECK ("sizeBytes" >= 0)
);

CREATE UNIQUE INDEX "LeadAttachment_storageProvider_storageKey_key"
  ON "LeadAttachment"("storageProvider", "storageKey");
CREATE INDEX "LeadAttachment_leadId_idx" ON "LeadAttachment"("leadId");

ALTER TABLE "LeadAttachment"
  ADD CONSTRAINT "LeadAttachment_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
