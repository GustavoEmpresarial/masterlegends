-- Official rarity index: 0 comum, 1 incomum, 2 raro, 3 super raro, 4 épico, 5 lendário.
-- Existing rare and above move up one step. Mythic (5) stays in the legendary band.
-- OVERWALL is stable from the row id and always inside the new inclusive band.

CREATE OR REPLACE FUNCTION mll_band_overwall(rarity integer, seed text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  lo integer;
  hi integer;
  span integer;
  bucket bigint;
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
  bucket := abs(hashtext(seed)::bigint) % span;
  RETURN lo + bucket::integer;
END;
$$;

UPDATE "BasePlayer"
SET rarity = rarity + 1
WHERE rarity BETWEEN 1 AND 4;

UPDATE "PlayerCache"
SET rarity = rarity + 1
WHERE rarity BETWEEN 1 AND 4;

UPDATE "ItemTemplate"
SET rarity = rarity + 1
WHERE rarity BETWEEN 1 AND 4;

UPDATE "BasePlayer"
SET overwall = mll_band_overwall(rarity, id);

UPDATE "PlayerCache"
SET overwall = mll_band_overwall(rarity, "tokenId"::text);

UPDATE "ItemTemplate"
SET overwall = mll_band_overwall(rarity, id);

UPDATE "Listing" AS listing
SET rarity = player.rarity,
    overwall = player.overwall
FROM "BasePlayer" AS player
WHERE listing."basePlayerId" = player.id;

UPDATE "Listing" AS listing
SET rarity = player.rarity,
    overwall = player.overwall
FROM "PlayerCache" AS player
WHERE listing."tokenId" = player."tokenId";

UPDATE "Listing"
SET rarity = rarity + 1
WHERE "basePlayerId" IS NULL
  AND "tokenId" IS NULL
  AND rarity BETWEEN 1 AND 4;

UPDATE "Listing"
SET overwall = mll_band_overwall(rarity, id)
WHERE "basePlayerId" IS NULL
  AND "tokenId" IS NULL;

UPDATE "Club" AS club
SET "totalOverwall" = COALESCE((
  SELECT SUM(player.overwall)::int
  FROM "BasePlayer" AS player
  WHERE player."userId" = club."userId"
), 0);

-- Wide defender posts become laterals. Existing assignments stay on the same slot id.
CREATE OR REPLACE FUNCTION mll_slots_with_laterals(slots jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_agg(
    CASE
      WHEN elem->>'id' = 's002' THEN jsonb_set(jsonb_set(elem, '{role}', '"LAT"'), '{label}', '"LAT-1"')
      WHEN elem->>'id' = 's005' THEN jsonb_set(jsonb_set(elem, '{role}', '"LAT"'), '{label}', '"LAT-2"')
      ELSE elem
    END
    ORDER BY ord
  )
  FROM jsonb_array_elements(slots) WITH ORDINALITY AS slot(elem, ord);
$$;

UPDATE "StadiumTemplate"
SET slots = mll_slots_with_laterals(slots::jsonb)
WHERE slots IS NOT NULL;

UPDATE "VestiarioTemplate"
SET slots = mll_slots_with_laterals(slots::jsonb)
WHERE slots IS NOT NULL;

DROP FUNCTION mll_slots_with_laterals(jsonb);
DROP FUNCTION mll_band_overwall(integer, text);
