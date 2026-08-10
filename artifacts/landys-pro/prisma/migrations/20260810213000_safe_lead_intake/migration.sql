CREATE TYPE "LeadReviewStatus" AS ENUM ('PENDING_REVIEW', 'READY', 'ROUTED');
CREATE TYPE "LeadRoutingMode" AS ENUM ('GENERAL', 'DIRECT');

ALTER TABLE "Lead"
  ALTER COLUMN "landownerName" DROP NOT NULL,
  ALTER COLUMN "landownerPhone" DROP NOT NULL,
  ALTER COLUMN "tier" DROP NOT NULL,
  ALTER COLUMN "priceCents" DROP NOT NULL,
  ALTER COLUMN "expiresAt" DROP NOT NULL,
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "propertyZip" TEXT,
  ADD COLUMN "budget" TEXT,
  ADD COLUMN "timeline" TIMESTAMP(3),
  ADD COLUMN "urgency" TEXT,
  ADD COLUMN "reviewStatus" "LeadReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "tierReviewRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "contractorReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "routingMode" "LeadRoutingMode" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "directContractorSource" TEXT,
  ADD COLUMN "directContractorExternalId" TEXT,
  ADD COLUMN "externalRequestId" TEXT,
  ADD COLUMN "payloadHash" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "routedAt" TIMESTAMP(3);

-- Existing leads are already resolved snapshots. Preserve every historical
-- tier, price, expiry, match, status, and transaction unchanged.
UPDATE "Lead"
SET
  "reviewStatus" = 'ROUTED',
  "tierReviewRequired" = false,
  "contractorReviewRequired" = false,
  "routedAt" = "createdAt";

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_tier_valid_when_resolved"
  CHECK ("tier" IS NULL OR "tier" BETWEEN 1 AND 3),
  ADD CONSTRAINT "Lead_price_nonnegative_when_resolved"
  CHECK ("priceCents" IS NULL OR "priceCents" >= 0);

CREATE INDEX "Lead_reviewStatus_idx" ON "Lead"("reviewStatus");
CREATE UNIQUE INDEX "Lead_source_externalRequestId_key"
  ON "Lead"("source", "externalRequestId");
