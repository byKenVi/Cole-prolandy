CREATE TABLE "ExternalContractorIdentity" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "lastPayloadHash" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalContractorIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalContractorIdentity_source_externalId_key"
  ON "ExternalContractorIdentity"("source", "externalId");
CREATE INDEX "ExternalContractorIdentity_contractorId_idx"
  ON "ExternalContractorIdentity"("contractorId");

ALTER TABLE "ExternalContractorIdentity"
  ADD CONSTRAINT "ExternalContractorIdentity_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
