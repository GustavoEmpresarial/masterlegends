-- CreateTable
CREATE TABLE "EventCampaign" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" VARCHAR(512),
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestDefinition" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "campaignId" TEXT,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "trigger" VARCHAR(64) NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "rewards" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "maxClaimsPerUser" INTEGER NOT NULL DEFAULT 1,
    "maxGlobalClaims" INTEGER,
    "requireEmailVerified" BOOLEAN NOT NULL DEFAULT true,
    "period" VARCHAR(16) NOT NULL DEFAULT 'none',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "periodKey" VARCHAR(32) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "periodKey" VARCHAR(32) NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestClaimLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "periodKey" VARCHAR(32) NOT NULL,
    "rewards" JSONB NOT NULL,
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestClaimLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventBadge" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "iconUrl" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCampaign_slug_key" ON "EventCampaign"("slug");

-- CreateIndex
CREATE INDEX "EventCampaign_active_startsAt_endsAt_idx" ON "EventCampaign"("active", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "EventCampaign_sortOrder_idx" ON "EventCampaign"("sortOrder");

-- CreateIndex
CREATE INDEX "QuestDefinition_active_kind_sortOrder_idx" ON "QuestDefinition"("active", "kind", "sortOrder");

-- CreateIndex
CREATE INDEX "QuestDefinition_trigger_active_idx" ON "QuestDefinition"("trigger", "active");

-- CreateIndex
CREATE INDEX "QuestDefinition_campaignId_idx" ON "QuestDefinition"("campaignId");

-- CreateIndex
CREATE INDEX "QuestProgress_userId_questId_idx" ON "QuestProgress"("userId", "questId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestProgress_userId_questId_periodKey_key" ON "QuestProgress"("userId", "questId", "periodKey");

-- CreateIndex
CREATE INDEX "QuestClaim_questId_claimedAt_idx" ON "QuestClaim"("questId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestClaim_userId_questId_periodKey_key" ON "QuestClaim"("userId", "questId", "periodKey");

-- CreateIndex
CREATE INDEX "QuestClaimLog_questId_createdAt_idx" ON "QuestClaimLog"("questId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestClaimLog_userId_createdAt_idx" ON "QuestClaimLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventBadge_code_key" ON "EventBadge"("code");

-- CreateIndex
CREATE INDEX "UserBadge_userId_idx" ON "UserBadge"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeId_key" ON "UserBadge"("userId", "badgeId");

-- AddForeignKey
ALTER TABLE "QuestDefinition" ADD CONSTRAINT "QuestDefinition_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "EventCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProgress" ADD CONSTRAINT "QuestProgress_questId_fkey" FOREIGN KEY ("questId") REFERENCES "QuestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestClaim" ADD CONSTRAINT "QuestClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestClaim" ADD CONSTRAINT "QuestClaim_questId_fkey" FOREIGN KEY ("questId") REFERENCES "QuestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestClaimLog" ADD CONSTRAINT "QuestClaimLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestClaimLog" ADD CONSTRAINT "QuestClaimLog_questId_fkey" FOREIGN KEY ("questId") REFERENCES "QuestDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "EventBadge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
