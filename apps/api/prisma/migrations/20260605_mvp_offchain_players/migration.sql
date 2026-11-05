-- AlterTable
ALTER TABLE "Club" ADD COLUMN "lastFarmAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "BasePlayer" ADD COLUMN "rarity" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BasePlayer" ADD COLUMN "listed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "basePlayerId" TEXT;
ALTER TABLE "Listing" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Listing" ALTER COLUMN "tokenId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Listing_basePlayerId_key" ON "Listing"("basePlayerId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_basePlayerId_fkey" FOREIGN KEY ("basePlayerId") REFERENCES "BasePlayer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
