-- Scale scout career costBasis by rarity (×5 per tier) for all rarities.
-- Mint price stays 2 GMT; only the ROI/retirement target scales.
-- Idempotent: only touches scout cards still at flat paid unit (≤ 2.01).

UPDATE "BasePlayer"
SET "costBasisUsdc" = ROUND(
  ("costBasisUsdc"::numeric * POWER(5::numeric, "rarity"))::numeric,
  6
)
WHERE "source" = 'scout'
  AND "rarity" >= 1
  AND "retiredAt" IS NULL
  AND "costBasisUsdc" > 0
  AND "costBasisUsdc" <= 2.01;
