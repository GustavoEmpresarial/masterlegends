ALTER TABLE "PlatformConfig"
  ADD COLUMN IF NOT EXISTS "referralGiftNftName"     VARCHAR(64)  NOT NULL DEFAULT 'Craque Indicação',
  ADD COLUMN IF NOT EXISTS "referralGiftNftImageUrl"  VARCHAR(512),
  ADD COLUMN IF NOT EXISTS "referralGiftNftOverwall"  INTEGER      NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "referralGiftNftPosition"  INTEGER      NOT NULL DEFAULT 2;
