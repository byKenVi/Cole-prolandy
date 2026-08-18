-- Live Wix taxonomy v3: additive work types, budget bands, v3 categories/land types.
-- Preserves all historical taxonomy rows and financial data.

CREATE TYPE "BudgetBand" AS ENUM (
  'UNDER_5K',
  'BETWEEN_5K_15K',
  'BETWEEN_15K_50K',
  'OVER_50K'
);

ALTER TABLE "ContractorCategory"
  ADD COLUMN IF NOT EXISTS "isActiveForNewIntake" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "LandType"
  ADD COLUMN IF NOT EXISTS "isActiveForNewIntake" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "WorkType" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "isActiveForNewIntake" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkType_name_key" ON "WorkType"("name");
CREATE UNIQUE INDEX "WorkType_code_key" ON "WorkType"("code");
CREATE INDEX "WorkType_archivedAt_idx" ON "WorkType"("archivedAt");

CREATE TABLE "BudgetBandTierMapping" (
  "id" TEXT NOT NULL,
  "workTypeId" TEXT NOT NULL,
  "budgetBand" "BudgetBand" NOT NULL,
  "tier" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BudgetBandTierMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BudgetBandTierMapping_workTypeId_budgetBand_key"
  ON "BudgetBandTierMapping"("workTypeId", "budgetBand");
CREATE INDEX "BudgetBandTierMapping_workTypeId_idx" ON "BudgetBandTierMapping"("workTypeId");

CREATE TABLE "WorkTypePriceTier" (
  "id" TEXT NOT NULL,
  "workTypeId" TEXT NOT NULL,
  "tier" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkTypePriceTier_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkTypePriceTier_workTypeId_tier_key" ON "WorkTypePriceTier"("workTypeId", "tier");
CREATE INDEX "WorkTypePriceTier_workTypeId_idx" ON "WorkTypePriceTier"("workTypeId");

CREATE TABLE "ContractorWorkType" (
  "id" TEXT NOT NULL,
  "contractorId" TEXT NOT NULL,
  "workTypeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractorWorkType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractorWorkType_contractorId_workTypeId_key"
  ON "ContractorWorkType"("contractorId", "workTypeId");
CREATE INDEX "ContractorWorkType_contractorId_idx" ON "ContractorWorkType"("contractorId");
CREATE INDEX "ContractorWorkType_workTypeId_idx" ON "ContractorWorkType"("workTypeId");

ALTER TABLE "BudgetBandTierMapping"
  ADD CONSTRAINT "BudgetBandTierMapping_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkTypePriceTier"
  ADD CONSTRAINT "WorkTypePriceTier_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractorWorkType"
  ADD CONSTRAINT "ContractorWorkType_contractorId_fkey"
  FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContractorWorkType"
  ADD CONSTRAINT "ContractorWorkType_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead"
  ADD COLUMN IF NOT EXISTS "budgetBand" "BudgetBand",
  ADD COLUMN IF NOT EXISTS "timelineCode" TEXT,
  ADD COLUMN IF NOT EXISTS "timelineRaw" TEXT,
  ADD COLUMN IF NOT EXISTS "urgencyCode" TEXT,
  ADD COLUMN IF NOT EXISTS "urgencyRaw" TEXT,
  ADD COLUMN IF NOT EXISTS "workTypeId" TEXT,
  ADD COLUMN IF NOT EXISTS "reviewBlocker" TEXT,
  ADD COLUMN IF NOT EXISTS "pricingReviewRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Lead" ALTER COLUMN "projectTypeId" DROP NOT NULL;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_workTypeId_fkey"
  FOREIGN KEY ("workTypeId") REFERENCES "WorkType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Lead_workTypeId_idx" ON "Lead"("workTypeId");

-- Archive legacy contractor categories from prior intake (rows preserved for historical FKs).
UPDATE "ContractorCategory"
SET
  "archivedAt" = COALESCE("archivedAt", CURRENT_TIMESTAMP),
  "isActiveForNewIntake" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "archivedAt" IS NULL
  AND "code" IN (
    'builders',
    'dirt-work-excavation',
    'farm-agriculture',
    'fencing-entrances',
    'forestry-timber',
    'land-clearing',
    'land-lenders',
    'land-realtors',
    'property-maintenance',
    'surveyors',
    'water-well-septic',
    'wildlife-management'
  );

INSERT INTO "ContractorCategory" ("id", "name", "code", "isActiveForNewIntake", "updatedAt")
VALUES
  ('ccat_v3_general_contractor', 'General Contractor', 'general-contractor', true, CURRENT_TIMESTAMP),
  ('ccat_v3_roofing', 'Roofing', 'roofing', true, CURRENT_TIMESTAMP),
  ('ccat_v3_plumbing', 'Plumbing', 'plumbing', true, CURRENT_TIMESTAMP),
  ('ccat_v3_electrical', 'Electrical', 'electrical', true, CURRENT_TIMESTAMP),
  ('ccat_v3_hvac', 'HVAC', 'hvac', true, CURRENT_TIMESTAMP),
  ('ccat_v3_landscaping', 'Landscaping', 'landscaping', true, CURRENT_TIMESTAMP),
  ('ccat_v3_flooring', 'Flooring', 'flooring', true, CURRENT_TIMESTAMP),
  ('ccat_v3_painting', 'Painting', 'painting', true, CURRENT_TIMESTAMP),
  ('ccat_v3_kitchen_bath', 'Kitchen & Bath', 'kitchen-bath', true, CURRENT_TIMESTAMP),
  ('ccat_v3_foundation_concrete', 'Foundation & Concrete', 'foundation-concrete', true, CURRENT_TIMESTAMP),
  ('ccat_v3_other', 'Other', 'other', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "archivedAt" = NULL,
  "isActiveForNewIntake" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Archive legacy land types for new intake; preserve rows referenced by historical leads.
UPDATE "LandType"
SET
  "archivedAt" = COALESCE("archivedAt", CURRENT_TIMESTAMP),
  "isActiveForNewIntake" = false
WHERE "archivedAt" IS NULL
  AND "code" IN (
    'development',
    'farmland',
    'homestead',
    'hunting',
    'ranching',
    'timberland'
  );

INSERT INTO "LandType" ("id", "name", "code", "isActiveForNewIntake")
VALUES
  ('ltype_v3_residential', 'Residential', 'residential', true),
  ('ltype_v3_commercial', 'Commercial', 'commercial', true),
  ('ltype_v3_multi_family', 'Multi-family', 'multi-family', true),
  ('ltype_v3_rural_land', 'Rural / Land', 'rural-land', true)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "archivedAt" = NULL,
  "isActiveForNewIntake" = true;

INSERT INTO "WorkType" ("id", "name", "code", "isActiveForNewIntake", "updatedAt")
VALUES
  ('wtype_new_build', 'New Build', 'new-build', true, CURRENT_TIMESTAMP),
  ('wtype_renovation_remodel', 'Renovation / Remodel', 'renovation-remodel', true, CURRENT_TIMESTAMP),
  ('wtype_repair', 'Repair', 'repair', true, CURRENT_TIMESTAMP),
  ('wtype_addition', 'Addition', 'addition', true, CURRENT_TIMESTAMP),
  ('wtype_installation', 'Installation', 'installation', true, CURRENT_TIMESTAMP),
  ('wtype_maintenance', 'Maintenance', 'maintenance', true, CURRENT_TIMESTAMP),
  ('wtype_inspection', 'Inspection', 'inspection', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "archivedAt" = NULL,
  "isActiveForNewIntake" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Provisional budget-band → tier defaults (admin-editable). Not lead prices.
INSERT INTO "BudgetBandTierMapping" ("id", "workTypeId", "budgetBand", "tier", "updatedAt")
SELECT
  'bbtm_' || wt."code" || '_' || lower(bands.band::text),
  wt."id",
  bands.band,
  bands.tier,
  CURRENT_TIMESTAMP
FROM "WorkType" wt
CROSS JOIN (
  VALUES
    ('new-build', 'UNDER_5K'::"BudgetBand", 1),
    ('new-build', 'BETWEEN_5K_15K', 1),
    ('new-build', 'BETWEEN_15K_50K', 2),
    ('new-build', 'OVER_50K', 3),
    ('addition', 'UNDER_5K', 1),
    ('addition', 'BETWEEN_5K_15K', 1),
    ('addition', 'BETWEEN_15K_50K', 2),
    ('addition', 'OVER_50K', 3),
    ('renovation-remodel', 'UNDER_5K', 1),
    ('renovation-remodel', 'BETWEEN_5K_15K', 2),
    ('renovation-remodel', 'BETWEEN_15K_50K', 3),
    ('renovation-remodel', 'OVER_50K', 3),
    ('inspection', 'UNDER_5K', 1),
    ('inspection', 'BETWEEN_5K_15K', 2),
    ('inspection', 'BETWEEN_15K_50K', 3),
    ('inspection', 'OVER_50K', 3)
) AS bands(work_code, band, tier)
WHERE wt."code" = bands.work_code
ON CONFLICT ("workTypeId", "budgetBand") DO UPDATE SET
  "tier" = EXCLUDED."tier",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "BudgetBandTierMapping" ("id", "workTypeId", "budgetBand", "tier", "updatedAt")
SELECT
  'bbtm_' || wt."code" || '_' || lower(bands.band::text),
  wt."id",
  bands.band,
  bands.tier,
  CURRENT_TIMESTAMP
FROM "WorkType" wt
CROSS JOIN (
  VALUES
    ('UNDER_5K'::"BudgetBand", 1),
    ('BETWEEN_5K_15K', 2),
    ('BETWEEN_15K_50K', 3),
    ('OVER_50K', 3)
) AS bands(band, tier)
WHERE wt."code" IN ('repair', 'installation', 'maintenance')
ON CONFLICT ("workTypeId", "budgetBand") DO UPDATE SET
  "tier" = EXCLUDED."tier",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Placeholder lead prices (PRICING_REQUIRED until admin configures). Does not alter historical PriceTier rows.
INSERT INTO "WorkTypePriceTier" ("id", "workTypeId", "tier", "priceCents", "updatedAt")
SELECT
  'wtpt_' || wt."code" || '_' || tiers.tier,
  wt."id",
  tiers.tier,
  0,
  CURRENT_TIMESTAMP
FROM "WorkType" wt
CROSS JOIN (VALUES (1), (2), (3)) AS tiers(tier)
WHERE wt."isActiveForNewIntake" = true
ON CONFLICT ("workTypeId", "tier") DO NOTHING;
