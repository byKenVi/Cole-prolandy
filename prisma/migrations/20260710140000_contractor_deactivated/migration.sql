-- Soft-deactivate contractors without destroying wallet/lead history.
ALTER TABLE "Contractor" ADD COLUMN "deactivatedAt" TIMESTAMP(3);

CREATE INDEX "Contractor_deactivatedAt_idx" ON "Contractor"("deactivatedAt");
