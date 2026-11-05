-- AlterTable
ALTER TABLE "Season" ADD COLUMN "rewardBlocks" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "passRankConfig" JSONB NOT NULL DEFAULT '[{"rank":"bronze","minLevel":1,"maxLevel":10,"bonusPct":0},{"rank":"prata","minLevel":11,"maxLevel":25,"bonusPct":0.05},{"rank":"ouro","minLevel":26,"maxLevel":50,"bonusPct":0.1},{"rank":"diamante","minLevel":51,"maxLevel":80,"bonusPct":0.15},{"rank":"lendario","minLevel":81,"maxLevel":100,"bonusPct":0.2}]';

-- CreateTable
CREATE TABLE "MissionProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "missionId" VARCHAR(64) NOT NULL,
    "period" VARCHAR(32) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "target" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgress_userId_seasonId_missionId_period_key" ON "MissionProgress"("userId", "seasonId", "missionId", "period");

-- CreateIndex
CREATE INDEX "MissionProgress_userId_expiresAt_idx" ON "MissionProgress"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "MissionProgress_expiresAt_idx" ON "MissionProgress"("expiresAt");

-- AddForeignKey
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionProgress" ADD CONSTRAINT "MissionProgress_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
