-- CreateTable
CREATE TABLE "WarehouseItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemType" VARCHAR(32) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "imageUrl" VARCHAR(512),
    "rarity" INTEGER NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "source" VARCHAR(32) NOT NULL,
    "sourceRef" VARCHAR(128),
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfferwallReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "transactionId" VARCHAR(128) NOT NULL,
    "amount" DECIMAL(18,6) NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'completed',
    "userIp" VARCHAR(45),
    "callbackRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfferwallReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WarehouseItem_userId_claimed_idx" ON "WarehouseItem"("userId", "claimed");

-- CreateIndex
CREATE INDEX "WarehouseItem_userId_source_idx" ON "WarehouseItem"("userId", "source");

-- CreateIndex
CREATE INDEX "WarehouseItem_expiresAt_idx" ON "WarehouseItem"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfferwallReward_transactionId_key" ON "OfferwallReward"("transactionId");

-- CreateIndex
CREATE INDEX "OfferwallReward_userId_provider_idx" ON "OfferwallReward"("userId", "provider");

-- AddForeignKey
ALTER TABLE "WarehouseItem" ADD CONSTRAINT "WarehouseItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferwallReward" ADD CONSTRAINT "OfferwallReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
