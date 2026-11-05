-- GMT disponível fica em amount. GMT comprometido fica em lockedAmount.
-- USDT de saque pendente sai do disponível e entra em usdtLockedAmount.

ALTER TABLE "MGTBalance" ADD COLUMN IF NOT EXISTS "lockedAmount" DECIMAL(36, 18) NOT NULL DEFAULT 0;
ALTER TABLE "MGTBalance" ADD COLUMN IF NOT EXISTS "usdtLockedAmount" DECIMAL(36, 18) NOT NULL DEFAULT 0;

UPDATE "MGTBalance" b
SET
  "usdtLockedAmount" = b."usdtLockedAmount" + LEAST(b."usdtAmount", p.pending),
  "usdtAmount" = b."usdtAmount" - LEAST(b."usdtAmount", p.pending)
FROM (
  SELECT "userId", COALESCE(SUM("requestedUsdc"), 0) AS pending
  FROM "WithdrawalRequest"
  WHERE status = 'pending'
  GROUP BY "userId"
) p
WHERE b."userId" = p."userId"
  AND b."usdtLockedAmount" = 0
  AND p.pending > 0;
