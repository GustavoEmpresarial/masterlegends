-- CreateTable
CREATE TABLE "ItemTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "imageUrl" VARCHAR(512) NOT NULL,
    "rarity" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "overwall" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemTemplate_active_rarity_idx" ON "ItemTemplate"("active", "rarity");

-- AlterTable
ALTER TABLE "BasePlayer"
  ADD COLUMN "name" VARCHAR(64),
  ADD COLUMN "imageUrl" VARCHAR(512),
  ADD COLUMN "templateId" TEXT;

-- CreateIndex
CREATE INDEX "BasePlayer_templateId_idx" ON "BasePlayer"("templateId");

-- AddForeignKey
ALTER TABLE "BasePlayer" ADD CONSTRAINT "BasePlayer_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ItemTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Listing"
  ADD COLUMN "name" VARCHAR(64),
  ADD COLUMN "imageUrl" VARCHAR(512);
