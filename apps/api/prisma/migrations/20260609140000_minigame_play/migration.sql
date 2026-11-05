-- CreateTable
CREATE TABLE "MinigamePlay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "minigameId" VARCHAR(32) NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinigamePlay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MinigamePlay_userId_minigameId_playedAt_idx" ON "MinigamePlay"("userId", "minigameId", "playedAt");

-- AddForeignKey
ALTER TABLE "MinigamePlay" ADD CONSTRAINT "MinigamePlay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
