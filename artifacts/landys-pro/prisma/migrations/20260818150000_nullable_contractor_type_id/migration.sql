-- Make contractorTypeId optional on Contractor so Wix-sourced contractors
-- can be persisted even when no project type taxonomy resolves.
ALTER TABLE "Contractor" ALTER COLUMN "contractorTypeId" DROP NOT NULL;
