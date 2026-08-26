-- Success-fee pivot: job outcomes, fees, follow-ups, landowner confirmation.

CREATE TYPE "JobOutcome" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "SuccessFeeStatus" AS ENUM ('AWAITING_CONTRACTOR_PAYMENT', 'DUE', 'PAID');
CREATE TYPE "FollowUpAction" AS ENUM ('REPORT_OUTCOME', 'CONFIRM_PAID', 'LANDOWNER_HIRED');

ALTER TABLE "LeadMatch" ADD COLUMN "jobOutcome" "JobOutcome" NOT NULL DEFAULT 'OPEN';
ALTER TABLE "LeadMatch" ADD COLUMN "finalContractValueCents" INTEGER;
ALTER TABLE "LeadMatch" ADD COLUMN "outcomeReportedAt" TIMESTAMP(3);
ALTER TABLE "LeadMatch" ADD COLUMN "followUpStage" TEXT;
ALTER TABLE "LeadMatch" ADD COLUMN "followUpNextAt" TIMESTAMP(3);
ALTER TABLE "LeadMatch" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "LeadMatch_followUpNextAt_idx" ON "LeadMatch"("followUpNextAt");
CREATE INDEX "LeadMatch_jobOutcome_idx" ON "LeadMatch"("jobOutcome");

CREATE TABLE "SuccessFee" (
    "id" TEXT NOT NULL,
    "leadMatchId" TEXT NOT NULL,
    "finalValueCents" INTEGER NOT NULL,
    "rateBasisPoints" INTEGER NOT NULL,
    "feeAmountCents" INTEGER NOT NULL,
    "status" "SuccessFeeStatus" NOT NULL DEFAULT 'AWAITING_CONTRACTOR_PAYMENT',
    "dueAt" TIMESTAMP(3),
    "stripePaymentIntentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "paidByAdminId" TEXT,
    "manualPaymentNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccessFee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SuccessFeeTier" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "maxValueCents" INTEGER,
    "rateBasisPoints" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuccessFeeTier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LandownerConfirmation" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "hired" BOOLEAN,
    "hiredLeadMatchId" TEXT,
    "respondedAt" TIMESTAMP(3),
    "mismatchFlagged" BOOLEAN NOT NULL DEFAULT false,
    "mismatchReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandownerConfirmation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FollowUpToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "action" "FollowUpAction" NOT NULL,
    "leadMatchId" TEXT,
    "leadId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SuccessFee_leadMatchId_key" ON "SuccessFee"("leadMatchId");
CREATE UNIQUE INDEX "SuccessFee_stripePaymentIntentId_key" ON "SuccessFee"("stripePaymentIntentId");
CREATE INDEX "SuccessFee_status_idx" ON "SuccessFee"("status");
CREATE UNIQUE INDEX "SuccessFeeTier_sortOrder_key" ON "SuccessFeeTier"("sortOrder");
CREATE UNIQUE INDEX "LandownerConfirmation_leadId_key" ON "LandownerConfirmation"("leadId");
CREATE UNIQUE INDEX "LandownerConfirmation_token_key" ON "LandownerConfirmation"("token");
CREATE INDEX "LandownerConfirmation_token_idx" ON "LandownerConfirmation"("token");
CREATE UNIQUE INDEX "FollowUpToken_token_key" ON "FollowUpToken"("token");
CREATE INDEX "FollowUpToken_token_idx" ON "FollowUpToken"("token");
CREATE INDEX "FollowUpToken_expiresAt_idx" ON "FollowUpToken"("expiresAt");

ALTER TABLE "SuccessFee" ADD CONSTRAINT "SuccessFee_leadMatchId_fkey" FOREIGN KEY ("leadMatchId") REFERENCES "LeadMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandownerConfirmation" ADD CONSTRAINT "LandownerConfirmation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LandownerConfirmation" ADD CONSTRAINT "LandownerConfirmation_hiredLeadMatchId_fkey" FOREIGN KEY ("hiredLeadMatchId") REFERENCES "LeadMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FollowUpToken" ADD CONSTRAINT "FollowUpToken_leadMatchId_fkey" FOREIGN KEY ("leadMatchId") REFERENCES "LeadMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FollowUpToken" ADD CONSTRAINT "FollowUpToken_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default success-fee tiers: < $10k → 5%, $10k–$24,999 → 4%, $25k+ → 3%
INSERT INTO "SuccessFeeTier" ("id", "sortOrder", "maxValueCents", "rateBasisPoints", "createdAt", "updatedAt")
VALUES
  ('sft_small', 1, 999999, 500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sft_medium', 2, 2499999, 400, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('sft_large', 3, NULL, 300, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("sortOrder") DO NOTHING;

INSERT INTO "AppSetting" ("key", "value", "updatedAt")
VALUES
  ('acceptanceUnlimited', 'false', CURRENT_TIMESTAMP),
  ('followUpOutcomeDelayHours', '72', CURRENT_TIMESTAMP),
  ('followUpPaymentDelayHours', '336', CURRENT_TIMESTAMP),
  ('followUpPaymentRetryHours', '168', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
