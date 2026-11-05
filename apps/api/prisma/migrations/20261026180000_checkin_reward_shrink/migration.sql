-- Cut daily check-in from +100 OW to +1, and the streak prize from 350 OW to a common 5 OW GK.
UPDATE "PlatformConfig"
SET
  "checkInStreakPlayerName" = 'Comum 1',
  "checkInStreakPlayerOverwall" = 5,
  "checkInStreakPlayerPosition" = 0,
  "checkInStreakPlayerImageUrl" = '/ui/bonecos/comum-1.png?v=1'
WHERE id = 'default';

UPDATE "CheckInGrant"
SET amount = 1
WHERE amount <> 1
  AND "expiresAt" > NOW();

UPDATE "BasePlayer"
SET
  overwall = 5,
  name = 'Comum 1',
  "imageUrl" = '/ui/bonecos/comum-1.png?v=1'
WHERE source = 'checkin_streak'
  AND "retiredAt" IS NULL
  AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
  AND overwall > 10;

UPDATE "Club" AS c
SET "totalOverwall" = COALESCE((
  SELECT SUM(p.overwall)
  FROM "BasePlayer" AS p
  WHERE p."userId" = c."userId"
    AND p."retiredAt" IS NULL
    AND (p."expiresAt" IS NULL OR p."expiresAt" > NOW())
), 0)
WHERE c."userId" IN (
  SELECT DISTINCT "userId" FROM "BasePlayer" WHERE source = 'checkin_streak'
);
