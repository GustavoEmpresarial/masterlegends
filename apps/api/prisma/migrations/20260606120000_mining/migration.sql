-- AlterTable
ALTER TABLE "PlatformConfig"
  ADD COLUMN "miningBlockRewardUsdc" DECIMAL(36,6) NOT NULL DEFAULT 0.1,
  ADD COLUMN "miningBlockIntervalMin" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "miningPaused" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MiningBlock" (
    "id" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "minedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalOverwall" BIGINT NOT NULL,
    "rewardUsdc" DECIMAL(36,6) NOT NULL,
    "participantCount" INTEGER NOT NULL,

    CONSTRAINT "MiningBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiningBlock_blockNumber_key" ON "MiningBlock"("blockNumber");
CREATE INDEX "MiningBlock_minedAt_idx" ON "MiningBlock"("minedAt");

-- CreateTable
CREATE TABLE "MiningReward" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "overwallSnapshot" INTEGER NOT NULL,
    "share" DECIMAL(20,18) NOT NULL,
    "amountUsdc" DECIMAL(36,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiningReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MiningReward_blockId_userId_key" ON "MiningReward"("blockId", "userId");
CREATE INDEX "MiningReward_userId_createdAt_idx" ON "MiningReward"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "MiningReward" ADD CONSTRAINT "MiningReward_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "MiningBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MiningReward" ADD CONSTRAINT "MiningReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MiningBalance" (
    "userId" TEXT NOT NULL,
    "pending" DECIMAL(36,6) NOT NULL DEFAULT 0,
    "lifetimeEarned" DECIMAL(36,6) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MiningBalance_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "MiningBalance" ADD CONSTRAINT "MiningBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
