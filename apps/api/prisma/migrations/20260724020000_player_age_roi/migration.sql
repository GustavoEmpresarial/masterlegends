-- Player career age / ROI: cost basis + attributed mining earnings
ALTER TABLE "BasePlayer" ADD COLUMN IF NOT EXISTS "costBasisUsdc" DECIMAL(36,6) NOT NULL DEFAULT 0;
ALTER TABLE "BasePlayer" ADD COLUMN IF NOT EXISTS "lifetimeEarnedUsdc" DECIMAL(36,6) NOT NULL DEFAULT 0;
