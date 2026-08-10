-- Additive official taxonomy layer. ContractorType remains the existing
-- project-routing compatibility entity and is intentionally not renamed or
-- repurposed as ContractorCategory.

ALTER TABLE "ProjectType"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "LandType"
  ADD COLUMN "code" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TABLE "ContractorCategory" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContractorCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContractorCategory_name_key" ON "ContractorCategory"("name");
CREATE UNIQUE INDEX "ContractorCategory_code_key" ON "ContractorCategory"("code");
CREATE INDEX "ContractorCategory_archivedAt_idx" ON "ContractorCategory"("archivedAt");

ALTER TABLE "Contractor" ADD COLUMN "contractorCategoryId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "contractorCategoryId" TEXT;

CREATE INDEX "Contractor_contractorCategoryId_idx" ON "Contractor"("contractorCategoryId");
CREATE INDEX "Lead_contractorCategoryId_idx" ON "Lead"("contractorCategoryId");

ALTER TABLE "Contractor"
  ADD CONSTRAINT "Contractor_contractorCategoryId_fkey"
  FOREIGN KEY ("contractorCategoryId") REFERENCES "ContractorCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead"
  ADD CONSTRAINT "Lead_contractorCategoryId_fkey"
  FOREIGN KEY ("contractorCategoryId") REFERENCES "ContractorCategory"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ContractorCategory" ("id", "name", "code", "updatedAt")
VALUES
  ('ccat_land_clearing', 'Land Clearing', 'land-clearing', CURRENT_TIMESTAMP),
  ('ccat_surveyors', 'Surveyors', 'surveyors', CURRENT_TIMESTAMP),
  ('ccat_builders', 'Builders', 'builders', CURRENT_TIMESTAMP),
  ('ccat_dirt_excavation', 'Dirt Work & Excavation', 'dirt-work-excavation', CURRENT_TIMESTAMP),
  ('ccat_fencing_entrances', 'Fencing & Entrances', 'fencing-entrances', CURRENT_TIMESTAMP),
  ('ccat_well_septic', 'Water Well & Septic', 'water-well-septic', CURRENT_TIMESTAMP),
  ('ccat_forestry_timber', 'Forestry & Timber', 'forestry-timber', CURRENT_TIMESTAMP),
  ('ccat_property_maintenance', 'Property Maintenance', 'property-maintenance', CURRENT_TIMESTAMP),
  ('ccat_wildlife_management', 'Wildlife Management', 'wildlife-management', CURRENT_TIMESTAMP),
  ('ccat_farm_agriculture', 'Farm & Agriculture', 'farm-agriculture', CURRENT_TIMESTAMP),
  ('ccat_land_lenders', 'Land Lenders', 'land-lenders', CURRENT_TIMESTAMP),
  ('ccat_land_realtors', 'Land Realtors', 'land-realtors', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Preserve exact semantic LandType identities, then add missing official rows.
UPDATE "LandType" AS lt
SET "name" = official.name, "code" = official.code
FROM (
  VALUES
    ('Development', 'development'),
    ('Farmland', 'farmland'),
    ('Timberland', 'timberland'),
    ('Ranching', 'ranching'),
    ('Homestead', 'homestead'),
    ('Hunting', 'hunting')
) AS official(name, code)
WHERE lower(trim(lt."name")) = lower(official.name);

INSERT INTO "LandType" ("id", "name", "code")
SELECT 'ltype_' || official.code, official.name, official.code
FROM (
  VALUES
    ('Development', 'development'),
    ('Farmland', 'farmland'),
    ('Timberland', 'timberland'),
    ('Ranching', 'ranching'),
    ('Homestead', 'homestead'),
    ('Hunting', 'hunting')
) AS official(name, code)
WHERE NOT EXISTS (
  SELECT 1 FROM "LandType" lt WHERE lt."code" = official.code
);

UPDATE "LandType"
SET "code" = 'legacy-' || substr(md5("id"), 1, 20),
    "archivedAt" = COALESCE("archivedAt", CURRENT_TIMESTAMP)
WHERE "code" IS NULL;

-- Assign official codes to semantic ProjectType matches while preserving both
-- ProjectType and paired ContractorType identities.
UPDATE "ProjectType" AS pt
SET "name" = official.name, "code" = official.code
FROM (
  VALUES
    ('CULVERT INSTALL', 'culvert-install'),
    ('BARNDOMINIUM BUILDING', 'barndominium-building'),
    ('BRUSH HOGGING', 'brush-hogging'),
    ('POND BUILDING', 'pond-building'),
    ('CABIN CONSTRUCTION', 'cabin-construction'),
    ('DRIVEWAY CONSTRUCTION', 'driveway-construction'),
    ('WATER WELL DRILLING', 'water-well-drilling'),
    ('GATED ENTRANCE', 'gated-entrance'),
    ('DRAINAGE IMPROVEMENT', 'drainage-improvement'),
    ('IRRIGATION SYSTEM INSTALLATION', 'irrigation-system-installation'),
    ('RETAINING WALL CONSTRUCTION', 'retaining-wall-construction'),
    ('UTILITY TRENCHING', 'utility-trenching'),
    ('TREE REMOVAL & STUMP GRINDING', 'tree-removal-stump-grinding'),
    ('LAND GRADING & LEVELING', 'land-grading-leveling')
) AS official(name, code)
WHERE lower(trim(pt."name")) = lower(official.name);

UPDATE "ContractorType" AS ct
SET "name" = pt."name"
FROM "ProjectType" pt
WHERE pt."contractorTypeId" = ct."id"
  AND pt."code" IS NOT NULL;

-- Create missing official ProjectType rows with their required paired routing
-- identity. Zero-value tiers are non-purchasable placeholders; these new
-- projects remain archived until an admin supplies all three approved prices.
DO $$
DECLARE
  official RECORD;
  routing_id TEXT;
  project_id TEXT;
BEGIN
  FOR official IN
    SELECT * FROM (
      VALUES
        ('CULVERT INSTALL', 'culvert-install'),
        ('BARNDOMINIUM BUILDING', 'barndominium-building'),
        ('BRUSH HOGGING', 'brush-hogging'),
        ('POND BUILDING', 'pond-building'),
        ('CABIN CONSTRUCTION', 'cabin-construction'),
        ('DRIVEWAY CONSTRUCTION', 'driveway-construction'),
        ('WATER WELL DRILLING', 'water-well-drilling'),
        ('GATED ENTRANCE', 'gated-entrance'),
        ('DRAINAGE IMPROVEMENT', 'drainage-improvement'),
        ('IRRIGATION SYSTEM INSTALLATION', 'irrigation-system-installation'),
        ('RETAINING WALL CONSTRUCTION', 'retaining-wall-construction'),
        ('UTILITY TRENCHING', 'utility-trenching'),
        ('TREE REMOVAL & STUMP GRINDING', 'tree-removal-stump-grinding'),
        ('LAND GRADING & LEVELING', 'land-grading-leveling')
    ) AS valueset(name, code)
  LOOP
    SELECT pt."id" INTO project_id
    FROM "ProjectType" pt
    WHERE pt."code" = official.code;

    IF project_id IS NULL THEN
      SELECT ct."id" INTO routing_id
      FROM "ContractorType" ct
      WHERE lower(trim(ct."name")) = lower(official.name)
      ORDER BY ct."createdAt" ASC
      LIMIT 1;

      IF routing_id IS NULL THEN
        routing_id := 'ctype_' || replace(official.code, '-', '_');
        INSERT INTO "ContractorType" ("id", "name", "createdAt")
        VALUES (routing_id, official.name, CURRENT_TIMESTAMP);
      END IF;

      project_id := 'ptype_' || replace(official.code, '-', '_');
      INSERT INTO "ProjectType" (
        "id", "name", "code", "contractorTypeId", "createdAt", "archivedAt"
      )
      VALUES (
        project_id, official.name, official.code, routing_id,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    END IF;
  END LOOP;
END $$;

INSERT INTO "PriceTier" (
  "id", "contractorTypeId", "projectTypeId", "tier",
  "priceCents", "createdAt", "updatedAt"
)
SELECT
  'ptier_' || replace(pt."code", '-', '_') || '_' || tiers.tier,
  pt."contractorTypeId",
  pt."id",
  tiers.tier,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "ProjectType" pt
CROSS JOIN (VALUES (1), (2), (3)) AS tiers(tier)
WHERE pt."code" IN (
  'culvert-install',
  'barndominium-building',
  'brush-hogging',
  'pond-building',
  'cabin-construction',
  'driveway-construction',
  'water-well-drilling',
  'gated-entrance',
  'drainage-improvement',
  'irrigation-system-installation',
  'retaining-wall-construction',
  'utility-trenching',
  'tree-removal-stump-grinding',
  'land-grading-leveling'
)
ON CONFLICT ("contractorTypeId", "projectTypeId", "tier") DO NOTHING;

-- Official projects with incomplete/unapproved prices and all legacy project
-- values stay available historically but are excluded from new intake.
UPDATE "ProjectType" pt
SET "archivedAt" = COALESCE(pt."archivedAt", CURRENT_TIMESTAMP)
WHERE pt."code" IN (
  'culvert-install',
  'barndominium-building',
  'brush-hogging',
  'pond-building',
  'cabin-construction',
  'driveway-construction',
  'water-well-drilling',
  'gated-entrance',
  'drainage-improvement',
  'irrigation-system-installation',
  'retaining-wall-construction',
  'utility-trenching',
  'tree-removal-stump-grinding',
  'land-grading-leveling'
)
AND EXISTS (
  SELECT 1 FROM "PriceTier" price
  WHERE price."projectTypeId" = pt."id"
    AND price."priceCents" < 100
);

UPDATE "ProjectType"
SET "code" = 'legacy-' || substr(md5("id"), 1, 20),
    "archivedAt" = COALESCE("archivedAt", CURRENT_TIMESTAMP)
WHERE "code" IS NULL;

ALTER TABLE "ProjectType" ALTER COLUMN "code" SET NOT NULL;
ALTER TABLE "LandType" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "ProjectType_code_key" ON "ProjectType"("code");
CREATE INDEX "ProjectType_archivedAt_idx" ON "ProjectType"("archivedAt");
CREATE UNIQUE INDEX "LandType_code_key" ON "LandType"("code");
CREATE INDEX "LandType_archivedAt_idx" ON "LandType"("archivedAt");
