-- Production readiness (2026-11-13). Additive only: every new column is
-- nullable or has a default, so Replit's schema sync can apply it safely.

-- Contractor: service area, preferences, invitation queue, terms.
ALTER TABLE "Contractor" ADD COLUMN "deactivationSource" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "serviceZipCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Contractor" ADD COLUMN "serviceCounties" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Contractor" ADD COLUMN "serviceRadiusMiles" INTEGER;
ALTER TABLE "Contractor" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "leadsPausedUntil" TIMESTAMP(3);
ALTER TABLE "Contractor" ADD COLUMN "smsOptedOutAt" TIMESTAMP(3);
ALTER TABLE "Contractor" ADD COLUMN "inviteScheduledFor" TIMESTAMP(3);
ALTER TABLE "Contractor" ADD COLUMN "lastInvitedAt" TIMESTAMP(3);
ALTER TABLE "Contractor" ADD COLUMN "inviteCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Contractor" ADD COLUMN "inviteLastError" TEXT;
ALTER TABLE "Contractor" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);
CREATE INDEX "Contractor_inviteScheduledFor_idx" ON "Contractor"("inviteScheduledFor");

-- LeadMatch: follow-up reminders and landowner notification tracking.
ALTER TABLE "LeadMatch" ADD COLUMN "followUpAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LeadMatch" ADD COLUMN "landownerNotifiedAt" TIMESTAMP(3);

-- SuccessFee: payment reminders.
ALTER TABLE "SuccessFee" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
ALTER TABLE "SuccessFee" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;

-- LandownerConfirmation: scheduled "did you hire?" email.
ALTER TABLE "LandownerConfirmation" ADD COLUMN "sendAfter" TIMESTAMP(3);
ALTER TABLE "LandownerConfirmation" ADD COLUMN "sentAt" TIMESTAMP(3);
ALTER TABLE "LandownerConfirmation" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- Login-free success-fee payment links.
ALTER TYPE "FollowUpAction" ADD VALUE IF NOT EXISTS 'PAY_FEE';

-- Notification outbox.
CREATE TABLE "NotificationMessage" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "html" TEXT,
    "contractorId" TEXT,
    "leadId" TEXT,
    "leadMatchId" TEXT,
    "sendAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "providerId" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "NotificationMessage_status_sendAfter_idx" ON "NotificationMessage"("status", "sendAfter");
CREATE INDEX "NotificationMessage_contractorId_idx" ON "NotificationMessage"("contractorId");
CREATE INDEX "NotificationMessage_leadId_idx" ON "NotificationMessage"("leadId");
CREATE INDEX "NotificationMessage_createdAt_idx" ON "NotificationMessage"("createdAt");
