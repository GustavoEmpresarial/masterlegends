-- Add global scout/mint discount (0 = no discount, 0.5 = 50% off, etc.)
ALTER TABLE "PlatformConfig"
  ADD COLUMN IF NOT EXISTS "scoutDiscountPct" DECIMAL(5,4) NOT NULL DEFAULT 0;
