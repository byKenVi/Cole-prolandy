-- CreateTable
CREATE TABLE "ContractorProject" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "contractorTypeId" TEXT NOT NULL,

    CONSTRAINT "ContractorProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractorProject_contractorId_idx" ON "ContractorProject"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorProject_contractorTypeId_idx" ON "ContractorProject"("contractorTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorProject_contractorId_contractorTypeId_key" ON "ContractorProject"("contractorId", "contractorTypeId");

-- AddForeignKey
ALTER TABLE "ContractorProject" ADD CONSTRAINT "ContractorProject_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorProject" ADD CONSTRAINT "ContractorProject_contractorTypeId_fkey" FOREIGN KEY ("contractorTypeId") REFERENCES "ContractorType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ContractorProject" ("id", "contractorId", "contractorTypeId")
SELECT 'cproj_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 20), c."id", c."contractorTypeId"
FROM "Contractor" c
WHERE NOT EXISTS (
  SELECT 1 FROM "ContractorProject" cp
  WHERE cp."contractorId" = c."id" AND cp."contractorTypeId" = c."contractorTypeId"
);
