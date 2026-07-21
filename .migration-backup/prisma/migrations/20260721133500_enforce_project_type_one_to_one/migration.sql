-- The product exposes one project level with three prices; prevent hidden
-- duplicate ProjectType rows from recreating the removed nested hierarchy.
CREATE UNIQUE INDEX "ProjectType_contractorTypeId_key"
ON "ProjectType"("contractorTypeId");
