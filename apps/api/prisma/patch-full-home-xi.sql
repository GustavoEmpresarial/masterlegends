-- Full home XI + ensure base players for teste@mll.local
INSERT INTO "BasePlayer" (
  "id", "userId", "rarity", "overwall", "position", "name", "stamina",
  "staminaUpdatedAt", "createdAt", "source"
)
SELECT v.id, u.id, v.rarity, v.ow, v.pos, v.name, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'admin'
FROM "User" u
CROSS JOIN (VALUES
  ('00000000-0000-4000-8000-aa0000000001', 'Ramos',  3, 80, 0),
  ('00000000-0000-4000-8000-aa0000000002', 'Costa',  1, 74, 1),
  ('00000000-0000-4000-8000-aa0000000003', 'Vieira', 2, 76, 1),
  ('00000000-0000-4000-8000-aa0000000004', 'Santos', 1, 73, 1),
  ('00000000-0000-4000-8000-aa0000000005', 'Lima',   2, 75, 1),
  ('00000000-0000-4000-8000-aa0000000006', 'Nunes',  3, 79, 2),
  ('00000000-0000-4000-8000-aa0000000007', 'Rocha',  4, 83, 2),
  ('00000000-0000-4000-8000-aa0000000008', 'Dias',   2, 77, 2),
  ('00000000-0000-4000-8000-aa0000000009', 'Silva',  3, 82, 3),
  ('00000000-0000-4000-8000-aa000000000a', 'Alves',  4, 85, 3),
  ('00000000-0000-4000-8000-aa000000000b', 'Pinto',  3, 80, 3)
) AS v(id, name, rarity, ow, pos)
WHERE u.email = 'teste@mll.local'
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "rarity" = EXCLUDED."rarity",
  "overwall" = EXCLUDED."overwall",
  "position" = EXCLUDED."position",
  "userId" = EXCLUDED."userId";

UPDATE "ClubLineup" cl
SET
  "assignments" = '{
    "s001":{"playerId":"00000000-0000-4000-8000-aa0000000001","kind":"base"},
    "s002":{"playerId":"00000000-0000-4000-8000-aa0000000002","kind":"base"},
    "s003":{"playerId":"00000000-0000-4000-8000-aa0000000003","kind":"base"},
    "s004":{"playerId":"00000000-0000-4000-8000-aa0000000004","kind":"base"},
    "s005":{"playerId":"00000000-0000-4000-8000-aa0000000005","kind":"base"},
    "s006":{"playerId":"00000000-0000-4000-8000-aa0000000006","kind":"base"},
    "s007":{"playerId":"00000000-0000-4000-8000-aa0000000007","kind":"base"},
    "s008":{"playerId":"00000000-0000-4000-8000-aa0000000008","kind":"base"},
    "s009":{"playerId":"00000000-0000-4000-8000-aa0000000009","kind":"base"},
    "s010":{"playerId":"00000000-0000-4000-8000-aa000000000a","kind":"base"},
    "s011":{"playerId":"00000000-0000-4000-8000-aa000000000b","kind":"base"}
  }'::jsonb,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Club" c
JOIN "User" u ON u.id = c."userId"
WHERE cl."clubId" = c.id AND u.email = 'teste@mll.local';
