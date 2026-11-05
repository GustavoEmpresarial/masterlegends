-- AlterTable
ALTER TABLE "User" ADD COLUMN "bannedAt" TIMESTAMP(3),
ADD COLUMN "banReason" VARCHAR(255),
ADD COLUMN "bannedBy" VARCHAR(64);

-- CreateTable
CREATE TABLE "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "amountUsdc" DECIMAL(36,6) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "adminNote" VARCHAR(512),
    "reviewedBy" VARCHAR(64),
    "reviewedAt" TIMESTAMP(3),
    "txHash" VARCHAR(66),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "minDepositUsdc" DECIMAL(36,6) NOT NULL DEFAULT 1,
    "minWithdrawUsdc" DECIMAL(36,6) NOT NULL DEFAULT 1,
    "withdrawalsPaused" BOOLEAN NOT NULL DEFAULT false,
    "vaultAddress" VARCHAR(42),
    "updatedBy" VARCHAR(64),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteAnnouncement" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "dismissible" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdBy" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAnnouncementDismissal" (
    "userId" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAnnouncementDismissal_pkey" PRIMARY KEY ("userId","announcementId")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "category" VARCHAR(32) NOT NULL DEFAULT 'general',
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "priority" VARCHAR(16) NOT NULL DEFAULT 'normal',
    "assignedTo" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" VARCHAR(8) NOT NULL,
    "authorId" VARCHAR(64) NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_createdAt_idx" ON "WithdrawalRequest"("status", "createdAt");
CREATE INDEX "WithdrawalRequest_userId_createdAt_idx" ON "WithdrawalRequest"("userId", "createdAt");
CREATE INDEX "SiteAnnouncement_active_startsAt_idx" ON "SiteAnnouncement"("active", "startsAt");
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");
CREATE INDEX "SupportMessage_ticketId_createdAt_idx" ON "SupportMessage"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAnnouncementDismissal" ADD CONSTRAINT "UserAnnouncementDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserAnnouncementDismissal" ADD CONSTRAINT "UserAnnouncementDismissal_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "SiteAnnouncement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default platform config
INSERT INTO "PlatformConfig" ("id", "minDepositUsdc", "minWithdrawUsdc", "withdrawalsPaused", "updatedAt")
VALUES ('default', 1, 1, false, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
