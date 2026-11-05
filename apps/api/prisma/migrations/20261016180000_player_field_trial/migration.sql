-- CreateTable
CREATE TABLE "PlayerFieldTrial" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" VARCHAR(8) NOT NULL,
    "playerId" VARCHAR(64) NOT NULL,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerFieldTrial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerFieldTrial_kind_playerId_key" ON "PlayerFieldTrial"("kind", "playerId");

-- CreateIndex
CREATE INDEX "PlayerFieldTrial_userId_idx" ON "PlayerFieldTrial"("userId");

-- AddForeignKey
ALTER TABLE "PlayerFieldTrial" ADD CONSTRAINT "PlayerFieldTrial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
