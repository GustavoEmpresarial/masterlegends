-- CreateTable
CREATE TABLE "DepositClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "failReason" VARCHAR(64),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DepositClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapPhase" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL,
    "color" VARCHAR(32) NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "i18n" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "i18n" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepositClaim_txHash_key" ON "DepositClaim"("txHash");

-- CreateIndex
CREATE INDEX "DepositClaim_status_lastCheckedAt_idx" ON "DepositClaim"("status", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "DepositClaim_userId_createdAt_idx" ON "DepositClaim"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RoadmapPhase_order_idx" ON "RoadmapPhase"("order");

-- CreateIndex
CREATE INDEX "RoadmapItem_phaseId_order_idx" ON "RoadmapItem"("phaseId", "order");

-- AddForeignKey
ALTER TABLE "DepositClaim" ADD CONSTRAINT "DepositClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "RoadmapPhase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
