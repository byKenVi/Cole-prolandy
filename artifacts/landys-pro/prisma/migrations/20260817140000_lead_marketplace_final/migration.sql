-- Lead marketplace final: budget tiers, purchase caps, category memberships, Wix sync metadata.

-- Lead status + match status extensions
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'SOLD_OUT';
ALTER TYPE "LeadMatchStatus" ADD VALUE IF NOT EXISTS 'SOLD_OUT';

-- Lead purchase + budget fields
ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "budgetCents" INTEGER,
  ADD COLUMN IF NOT EXISTS "maxPurchases" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "acceptedCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "soldOutAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "budgetReviewRequired" BOOLEAN NOT NULL DEFAULT false;

-- Price tier budget thresholds (tiers 1 and 2 only)
ALTER TABLE "PriceTier"
  ADD COLUMN IF NOT EXISTS "maxBudgetCents" INTEGER;

-- Attachment ingestion diagnostics
ALTER TABLE "LeadAttachment"
  ADD COLUMN IF NOT EXISTS "ingestionError" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

-- External contractor sync metadata
ALTER TABLE "ExternalContractorIdentity"
  ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceMetadata" JSONB;

-- Multi-category contractor memberships
CREATE TABLE IF NOT EXISTS "ContractorCategoryMembership" (
  "id" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractorCategoryMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ContractorCategoryMembership_contractorId_categoryId_key"
  ON "ContractorCategoryMembership"("contractorId", "categoryId");
CREATE INDEX IF NOT EXISTS "ContractorCategoryMembership_contractorId_idx"
  ON "ContractorCategoryMembership"("contractorId");
CREATE INDEX IF NOT EXISTS "ContractorCategoryMembership_categoryId_idx"
  ON "ContractorCategoryMembership"("categoryId");

ALTER TABLE "ContractorCategoryMembership"
  ADD CONSTRAINT "ContractorCategoryMembership_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContractorCategoryMembership"
  ADD CONSTRAINT "ContractorCategoryMembership_categoryId_fkey"
  FOREIGN KEY ("categoryId") REFERENCES "ContractorCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill primary category memberships from existing contractorCategoryId
INSERT INTO "ContractorCategoryMembership" ("id", "contractorId", "categoryId", "isPrimary", "displayOrder")
SELECT
  'ccm_' || substr(md5(c."id" || c."contractorCategoryId"), 1, 24),
  c."id",
  c."contractorCategoryId",
  true,
  0
FROM "Contractor" c
WHERE c."contractorCategoryId" IS NOT NULL
ON CONFLICT ("contractorId", "categoryId") DO NOTHING;

-- App settings: maxLeadPurchases (migrate from maxLeadRecipients default)
INSERT INTO "AppSetting" ("key", "value", "updatedAt")
SELECT 'maxLeadPurchases', COALESCE(
  (SELECT "value" FROM "AppSetting" WHERE "key" = 'maxLeadRecipients'),
  '3'
), CURRENT_TIMESTAMP
ON CONFLICT ("key") DO NOTHING;

-- Seed provisional budget thresholds (cents). Does not alter lead prices.
UPDATE "PriceTier" pt
SET "maxBudgetCents" = thresholds.max_cents, "updatedAt" = CURRENT_TIMESTAMP
FROM "ProjectType" p
JOIN (
  VALUES
    ('culvert-install', 1, 500000),
    ('culvert-install', 2, 1500000),
    ('barndominium-building', 1, 1000000),
    ('barndominium-building', 2, 3000000),
    ('brush-hogging', 1, 500000),
    ('brush-hogging', 2, 1500000),
    ('pond-building', 1, 750000),
    ('pond-building', 2, 2000000),
    ('cabin-construction', 1, 1000000),
    ('cabin-construction', 2, 3000000),
    ('driveway-construction', 1, 750000),
    ('driveway-construction', 2, 2000000),
    ('water-well-drilling', 1, 750000),
    ('water-well-drilling', 2, 2000000),
    ('gated-entrance', 1, 500000),
    ('gated-entrance', 2, 1500000),
    ('drainage-improvement', 1, 500000),
    ('drainage-improvement', 2, 1500000),
    ('irrigation-system-installation', 1, 750000),
    ('irrigation-system-installation', 2, 2000000),
    ('retaining-wall-construction', 1, 750000),
    ('retaining-wall-construction', 2, 2000000),
    ('utility-trenching', 1, 750000),
    ('utility-trenching', 2, 2000000),
    ('tree-removal-stump-grinding', 1, 500000),
    ('tree-removal-stump-grinding', 2, 1500000),
    ('land-grading-leveling', 1, 750000),
    ('land-grading-leveling', 2, 2000000)
) AS thresholds(code, tier, max_cents) ON p."code" = thresholds.code
WHERE pt."projectTypeId" = p."id"
  AND pt."tier" = thresholds.tier
  AND pt."maxBudgetCents" IS NULL;
