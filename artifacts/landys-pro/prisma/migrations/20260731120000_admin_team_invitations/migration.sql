-- Team management: persistent admin users + invitation tokens.
-- Replaces the ADMIN_EMAILS-only mechanism; ADMIN_EMAILS still bootstraps the
-- first OWNER on login, every later admin arrives through an AdminInvite.
--
-- Written defensively with existence guards: these tables were introduced into
-- schema.prisma without a migration, so some environments already have them
-- from a `prisma db push`. The guards let `migrate deploy` succeed on both a
-- fresh database and one that was pushed to.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "clerkUserId" TEXT,
    "invitedById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdminInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminUser_clerkUserId_key" ON "AdminUser"("clerkUserId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminUser_clerkUserId_idx" ON "AdminUser"("clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AdminInvite_token_key" ON "AdminInvite"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminInvite_email_idx" ON "AdminInvite"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminInvite_token_idx" ON "AdminInvite"("token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdminInvite_status_idx" ON "AdminInvite"("status");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "AdminInvite" ADD CONSTRAINT "AdminInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
