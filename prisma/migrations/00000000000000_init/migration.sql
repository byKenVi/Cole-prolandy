-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'DISTRIBUTED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeadMatchStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOPUP', 'LEAD_CHARGE', 'REFUND', 'ADMIN_ADJUST');

-- CreateTable
CREATE TABLE "ContractorType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractorType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractorTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractorTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "LandType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "aboutSection" TEXT,
    "businessHours" TEXT,
    "contractorTypeId" TEXT NOT NULL,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "isTopPro" BOOLEAN NOT NULL DEFAULT false,
    "walletBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "stripeCustomerId" TEXT,
    "clerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractorService" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,

    CONSTRAINT "ContractorService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "landownerName" TEXT NOT NULL,
    "landownerEmail" TEXT NOT NULL,
    "landownerPhone" TEXT NOT NULL,
    "propertyLocation" TEXT NOT NULL,
    "landTypeId" TEXT,
    "projectTypeId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'wix_form',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadMatch" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "status" "LeadMatchStatus" NOT NULL DEFAULT 'PENDING',
    "acceptToken" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "type" "WalletTransactionType" NOT NULL,
    "leadMatchId" TEXT,
    "stripePaymentIntentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTier" (
    "id" TEXT NOT NULL,
    "contractorTypeId" TEXT NOT NULL,
    "projectTypeId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractorType_name_key" ON "ContractorType"("name");

-- CreateIndex
CREATE INDEX "Service_contractorTypeId_idx" ON "Service"("contractorTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_name_contractorTypeId_key" ON "Service"("name", "contractorTypeId");

-- CreateIndex
CREATE INDEX "ProjectType_contractorTypeId_idx" ON "ProjectType"("contractorTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectType_name_contractorTypeId_key" ON "ProjectType"("name", "contractorTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LandType_name_key" ON "LandType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_email_key" ON "Contractor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Contractor_clerkUserId_key" ON "Contractor"("clerkUserId");

-- CreateIndex
CREATE INDEX "Contractor_contractorTypeId_idx" ON "Contractor"("contractorTypeId");

-- CreateIndex
CREATE INDEX "ContractorService_contractorId_idx" ON "ContractorService"("contractorId");

-- CreateIndex
CREATE INDEX "ContractorService_serviceId_idx" ON "ContractorService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractorService_contractorId_serviceId_key" ON "ContractorService"("contractorId", "serviceId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_projectTypeId_idx" ON "Lead"("projectTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadMatch_acceptToken_key" ON "LeadMatch"("acceptToken");

-- CreateIndex
CREATE INDEX "LeadMatch_contractorId_idx" ON "LeadMatch"("contractorId");

-- CreateIndex
CREATE INDEX "LeadMatch_leadId_idx" ON "LeadMatch"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadMatch_leadId_contractorId_key" ON "LeadMatch"("leadId", "contractorId");

-- CreateIndex
CREATE INDEX "WalletTransaction_contractorId_idx" ON "WalletTransaction"("contractorId");

-- CreateIndex
CREATE INDEX "WalletTransaction_leadMatchId_idx" ON "WalletTransaction"("leadMatchId");

-- CreateIndex
CREATE INDEX "PriceTier_contractorTypeId_idx" ON "PriceTier"("contractorTypeId");

-- CreateIndex
CREATE INDEX "PriceTier_projectTypeId_idx" ON "PriceTier"("projectTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "PriceTier_contractorTypeId_projectTypeId_tier_key" ON "PriceTier"("contractorTypeId", "projectTypeId", "tier");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_contractorTypeId_fkey" FOREIGN KEY ("contractorTypeId") REFERENCES "ContractorType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectType" ADD CONSTRAINT "ProjectType_contractorTypeId_fkey" FOREIGN KEY ("contractorTypeId") REFERENCES "ContractorType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contractor" ADD CONSTRAINT "Contractor_contractorTypeId_fkey" FOREIGN KEY ("contractorTypeId") REFERENCES "ContractorType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorService" ADD CONSTRAINT "ContractorService_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractorService" ADD CONSTRAINT "ContractorService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_landTypeId_fkey" FOREIGN KEY ("landTypeId") REFERENCES "LandType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMatch" ADD CONSTRAINT "LeadMatch_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadMatch" ADD CONSTRAINT "LeadMatch_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "Contractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_leadMatchId_fkey" FOREIGN KEY ("leadMatchId") REFERENCES "LeadMatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_contractorTypeId_fkey" FOREIGN KEY ("contractorTypeId") REFERENCES "ContractorType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTier" ADD CONSTRAINT "PriceTier_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "ProjectType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

