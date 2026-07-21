-- Remove unused service hierarchy and the unimplemented Top Pro placeholder.
DROP TABLE IF EXISTS "ContractorService";
DROP TABLE IF EXISTS "Service";
ALTER TABLE "Contractor" DROP COLUMN IF EXISTS "isTopPro";

-- Public estimate tier is runtime configuration managed from Admin Settings.
INSERT INTO "AppSetting" ("key", "value", "updatedAt")
VALUES ('defaultLeadTier', '2', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
