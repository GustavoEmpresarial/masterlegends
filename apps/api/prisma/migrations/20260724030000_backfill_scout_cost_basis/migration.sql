-- Existing scout mints predate costBasis tracking; set career cost to scout price (2 GMT ~ 2 USDC).
UPDATE "BasePlayer"
SET "costBasisUsdc" = 2
WHERE "source" = 'scout'
  AND "costBasisUsdc" = 0
  AND "retiredAt" IS NULL;
