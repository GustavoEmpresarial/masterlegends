-- AlterTable
ALTER TABLE "Club" ADD COLUMN "lastDailyRestAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BasePlayer" ADD COLUMN "stamina" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "BasePlayer" ADD COLUMN "staminaUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "StadiumShopItem" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "effectType" TEXT NOT NULL,
    "effectValue" INTEGER NOT NULL DEFAULT 0,
    "priceUsdc" DECIMAL(18,6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StadiumShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StadiumShopItem_slug_key" ON "StadiumShopItem"("slug");

-- CreateIndex
CREATE INDEX "StadiumShopItem_active_sortOrder_idx" ON "StadiumShopItem"("active", "sortOrder");

-- CreateIndex
CREATE INDEX "BasePlayer_userId_stamina_idx" ON "BasePlayer"("userId", "stamina");

-- Seed default shop items
INSERT INTO "StadiumShopItem" ("id", "slug", "nameKey", "effectType", "effectValue", "priceUsdc", "active", "sortOrder", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'energy_drink', 'shop.items.energyDrink', 'stamina_flat', 25, 10.000000, true, 1, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'full_restore', 'shop.items.fullRestore', 'stamina_full', 100, 30.000000, true, 2, CURRENT_TIMESTAMP);
