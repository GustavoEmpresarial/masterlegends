-- CreateTable
CREATE TABLE "GearCatalogItem" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "nameKey" VARCHAR(128) NOT NULL,
    "slot" VARCHAR(32) NOT NULL,
    "rarity" INTEGER NOT NULL DEFAULT 0,
    "owBonus" INTEGER NOT NULL DEFAULT 0,
    "priceGmt" DECIMAL(18,6) NOT NULL,
    "imageUrl" VARCHAR(512),
    "description" VARCHAR(512),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "catalogItemId" TEXT NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'shop',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserGear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerGearEquip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerId" VARCHAR(64) NOT NULL,
    "playerKind" VARCHAR(8) NOT NULL,
    "slot" VARCHAR(32) NOT NULL,
    "userGearId" TEXT NOT NULL,
    "equippedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlayerGearEquip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GearCatalogItem_slug_key" ON "GearCatalogItem"("slug");

-- CreateIndex
CREATE INDEX "GearCatalogItem_active_slot_sortOrder_idx" ON "GearCatalogItem"("active", "slot", "sortOrder");

-- CreateIndex
CREATE INDEX "GearCatalogItem_active_rarity_idx" ON "GearCatalogItem"("active", "rarity");

-- CreateIndex
CREATE INDEX "UserGear_userId_idx" ON "UserGear"("userId");

-- CreateIndex
CREATE INDEX "UserGear_catalogItemId_idx" ON "UserGear"("catalogItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGearEquip_userGearId_key" ON "PlayerGearEquip"("userGearId");

-- CreateIndex
CREATE INDEX "PlayerGearEquip_userId_playerId_idx" ON "PlayerGearEquip"("userId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerGearEquip_userId_playerId_playerKind_slot_key" ON "PlayerGearEquip"("userId", "playerId", "playerKind", "slot");

-- AddForeignKey
ALTER TABLE "UserGear" ADD CONSTRAINT "UserGear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGear" ADD CONSTRAINT "UserGear_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "GearCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGearEquip" ADD CONSTRAINT "PlayerGearEquip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerGearEquip" ADD CONSTRAINT "PlayerGearEquip_userGearId_fkey" FOREIGN KEY ("userGearId") REFERENCES "UserGear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
