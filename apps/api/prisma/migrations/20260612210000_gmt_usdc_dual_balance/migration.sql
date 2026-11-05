-- Dual balance: GMT (amount) + USDC (usdcAmount). 1 USDC = 1 GMT via swap.
ALTER TABLE "MGTBalance" ADD COLUMN IF NOT EXISTS "usdcAmount" DECIMAL(36,18) NOT NULL DEFAULT 0;

-- Existing balances were deposited USDC credited to amount — move to usdcAmount (1:1).
UPDATE "MGTBalance"
SET "usdcAmount" = "amount", "amount" = 0
WHERE "usdcAmount" = 0 AND "amount" > 0;
