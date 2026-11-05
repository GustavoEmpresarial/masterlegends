-- merge_fee_costbasis_backfill_v1
-- Historical merges did not add the GMT merge fee into costBasisUsdc.
-- Add the standard tier fee once for active merge-sourced players
-- (output rarity → fee of input rarity = rarity - 1).
-- Idempotent via Prisma migration history (runs once).

UPDATE "BasePlayer"
SET "costBasisUsdc" = "costBasisUsdc" + CASE "rarity"
  WHEN 1 THEN 2   -- common→rare fee
  WHEN 2 THEN 5   -- rare→super-rare fee
  WHEN 3 THEN 10  -- super-rare→epic fee
  WHEN 4 THEN 15  -- epic→legendary fee
  WHEN 5 THEN 20  -- legendary→mythic fee
  ELSE 0
END
WHERE "source" = 'merge'
  AND "retiredAt" IS NULL
  AND "rarity" BETWEEN 1 AND 5;
