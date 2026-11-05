-- Fix players created by merge but tagged source='scout' (DB default before merge set source).
-- Also repair costBasis after scout backfill wrongly set them to 2.
-- Job: merge_source_and_costbasis_repair_v1 (idempotent via Prisma migration history).

WITH matched AS (
  SELECT DISTINCT ON (bp.id)
    bp.id AS player_id,
    ABS(t.amount::numeric) AS fee
  FROM "MGTTransaction" t
  JOIN "BasePlayer" bp
    ON bp."userId" = t."userId"
   AND bp."createdAt" BETWEEN t."createdAt" - interval '2 seconds'
                         AND t."createdAt" + interval '2 seconds'
   AND bp.rarity = COALESCE((t.meta->>'outputRarity')::int, -1)
  WHERE t.type = 'merge'
  ORDER BY bp.id, t."createdAt" DESC
)
UPDATE "BasePlayer" bp
SET
  "source" = 'merge',
  "costBasisUsdc" = CASE
    -- Scout backfill artifact (stuck at ≤2): estimate 5×scout chain by tier + fee
    WHEN bp."costBasisUsdc" <= 2 THEN (
      (10::numeric * POWER(5::numeric, GREATEST(bp.rarity - 1, 0))) + m.fee
    )
    -- Mis-tagged but already had basis → add missing fee once
    WHEN bp."source" IS DISTINCT FROM 'merge' THEN bp."costBasisUsdc" + m.fee
    ELSE bp."costBasisUsdc"
  END
FROM matched m
WHERE bp.id = m.player_id
  AND (
    bp."source" IS DISTINCT FROM 'merge'
    OR bp."costBasisUsdc" <= 2
  );
