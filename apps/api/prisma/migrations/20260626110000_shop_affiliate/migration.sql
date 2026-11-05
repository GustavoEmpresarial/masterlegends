-- Add affiliate/external product fields to StadiumShopItem
ALTER TABLE "StadiumShopItem"
  ADD COLUMN IF NOT EXISTS "imageUrl"         VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "affiliateUrl"     VARCHAR(1024),
  ADD COLUMN IF NOT EXISTS "description"      VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "externalPlatform" VARCHAR(32);

-- Allow longer nameKey for product names
ALTER TABLE "StadiumShopItem"
  ALTER COLUMN "nameKey" TYPE VARCHAR(128);

-- Allow new effectType value length
ALTER TABLE "StadiumShopItem"
  ALTER COLUMN "effectType" TYPE VARCHAR(20);
