-- AlterTable
ALTER TABLE "PlatformConfig" ADD COLUMN "checkInStreakPlayerName" VARCHAR(64) NOT NULL DEFAULT 'Craque Presença';
ALTER TABLE "PlatformConfig" ADD COLUMN "checkInStreakPlayerImageUrl" VARCHAR(512);
ALTER TABLE "PlatformConfig" ADD COLUMN "checkInStreakPlayerOverwall" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "PlatformConfig" ADD COLUMN "checkInStreakPlayerPosition" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "PlatformConfig" ADD COLUMN "checkInStreakPlayerDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "PlatformConfig" ADD COLUMN "checkInStreakThreshold" INTEGER NOT NULL DEFAULT 7;

-- CreateTable
CREATE TABLE "CheckInStreakReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "milestone" INTEGER NOT NULL,
    "checkInDay" DATE NOT NULL,
    "playerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInStreakReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckInStreakReward_userId_milestone_key" ON "CheckInStreakReward"("userId", "milestone");

-- CreateIndex
CREATE INDEX "CheckInStreakReward_userId_createdAt_idx" ON "CheckInStreakReward"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CheckInStreakReward" ADD CONSTRAINT "CheckInStreakReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
