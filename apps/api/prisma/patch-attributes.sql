-- Attributes inside the official OVERWALL band, stable from the player id.
-- FNV-1a 32-bit matches packages/shared/src/economy/attributes.ts (Math.imul wrap).

ALTER TABLE "BasePlayer" ADD COLUMN IF NOT EXISTS attributes JSONB;
ALTER TABLE "PlayerCache" ADD COLUMN IF NOT EXISTS attributes JSONB;

CREATE OR REPLACE FUNCTION mll_fnv1a32(seed text)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  h bigint := 2166136261;
  i int;
  c int;
  signed bigint;
  prod bigint;
BEGIN
  IF seed IS NULL THEN
    RETURN 0;
  END IF;
  FOR i IN 1..char_length(seed) LOOP
    c := ascii(substr(seed, i, 1));
    h := (h # c) & 4294967295;
    IF h >= 2147483648 THEN
      signed := h - 4294967296;
    ELSE
      signed := h;
    END IF;
    prod := signed * 16777619;
    h := prod & 4294967295;
  END LOOP;
  RETURN h;
END;
$$;

CREATE OR REPLACE FUNCTION mll_attr(seed text, rarity integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lo integer;
  hi integer;
  span integer;
BEGIN
  IF rarity <= 0 THEN
    lo := 1; hi := 10;
  ELSIF rarity = 1 THEN
    lo := 2; hi := 20;
  ELSIF rarity = 2 THEN
    lo := 4; hi := 40;
  ELSIF rarity = 3 THEN
    lo := 80; hi := 160;
  ELSIF rarity = 4 THEN
    lo := 320; hi := 640;
  ELSE
    lo := 1280; hi := 2560;
  END IF;
  span := hi - lo + 1;
  RETURN lo + (mll_fnv1a32(seed) % span);
END;
$$;

UPDATE "BasePlayer"
SET attributes = jsonb_build_object(
  'ataque', mll_attr(id || ':ataque', rarity),
  'defesa', mll_attr(id || ':defesa', rarity),
  'passe', mll_attr(id || ':passe', rarity),
  'velocidade', mll_attr(id || ':velocidade', rarity),
  'finalizacao', mll_attr(id || ':finalizacao', rarity),
  'forca', mll_attr(id || ':forca', rarity),
  'resistencia', mll_attr(id || ':resistencia', rarity),
  'tecnica', mll_attr(id || ':tecnica', rarity),
  'inteligencia', mll_attr(id || ':inteligencia', rarity),
  'goleiro', CASE WHEN position = 0 THEN mll_attr(id || ':goleiro', rarity) ELSE 0 END
);

UPDATE "PlayerCache"
SET attributes = jsonb_build_object(
  'ataque', mll_attr("tokenId"::text || ':ataque', rarity),
  'defesa', mll_attr("tokenId"::text || ':defesa', rarity),
  'passe', mll_attr("tokenId"::text || ':passe', rarity),
  'velocidade', mll_attr("tokenId"::text || ':velocidade', rarity),
  'finalizacao', mll_attr("tokenId"::text || ':finalizacao', rarity),
  'forca', mll_attr("tokenId"::text || ':forca', rarity),
  'resistencia', mll_attr("tokenId"::text || ':resistencia', rarity),
  'tecnica', mll_attr("tokenId"::text || ':tecnica', rarity),
  'inteligencia', mll_attr("tokenId"::text || ':inteligencia', rarity),
  'goleiro', CASE WHEN position = 0 THEN mll_attr("tokenId"::text || ':goleiro', rarity) ELSE 0 END
);

-- Drop starters standing in the wrong post. Slot ids are the vestiário slots.
WITH roles AS (
  SELECT elem->>'id' AS slot_id, elem->>'role' AS role
  FROM "VestiarioTemplate" AS template,
       LATERAL jsonb_array_elements(template.slots) AS elem
  WHERE template."isDefault" = true
),
cleaned AS (
  SELECT
    lineup."clubId",
    COALESCE(
      jsonb_object_agg(entry.key, entry.value) FILTER (
        WHERE entry.key IS NOT NULL
          AND (
          roles.role IS NULL
          OR roles.role = 'DECOR'
          OR (
            entry.value->>'kind' = 'base'
            AND CASE player.position
              WHEN 0 THEN 'GK'
              WHEN 1 THEN 'DEF'
              WHEN 2 THEN 'MID'
              WHEN 3 THEN 'FW'
              WHEN 4 THEN 'LAT'
              ELSE 'FW'
            END = roles.role
          )
          )
      ),
      '{}'::jsonb
    ) AS assignments
  FROM "ClubLineup" AS lineup
  LEFT JOIN LATERAL jsonb_each(lineup.assignments) AS entry(key, value) ON true
  LEFT JOIN roles ON roles.slot_id = entry.key
  LEFT JOIN "BasePlayer" AS player
    ON entry.value->>'kind' = 'base'
   AND player.id = entry.value->>'playerId'
  GROUP BY lineup."clubId"
)
UPDATE "ClubLineup" AS lineup
SET assignments = cleaned.assignments
FROM cleaned
WHERE lineup."clubId" = cleaned."clubId";

DROP FUNCTION mll_attr(text, integer);
DROP FUNCTION mll_fnv1a32(text);
