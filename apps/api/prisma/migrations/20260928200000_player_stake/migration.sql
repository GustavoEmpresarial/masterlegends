-- CreateTable
CREATE TABLE "PlayerStake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "playerId" VARCHAR(64) NOT NULL,
    "amount" DECIMAL(36,8) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'active',
    "stakedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unstakedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerStake_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerStake_kind_playerId_key" ON "PlayerStake"("kind", "playerId");

-- CreateIndex
CREATE INDEX "PlayerStake_userId_status_idx" ON "PlayerStake"("userId", "status");

-- AddForeignKey
ALTER TABLE "PlayerStake" ADD CONSTRAINT "PlayerStake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
