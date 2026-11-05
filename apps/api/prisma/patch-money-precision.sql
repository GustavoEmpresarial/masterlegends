-- Residual of a sponsorship round stays on the block. It is not paid to the last player.

ALTER TABLE "MiningBlock" ADD COLUMN IF NOT EXISTS "residualUsdt" DECIMAL(36, 6) NOT NULL DEFAULT 0;
