-- Five catalog stadiums + Teste FC home XI + signed licenses.

UPDATE "StadiumTemplate" SET "isDefault" = false WHERE "isDefault" = true;

INSERT INTO "StadiumTemplate" (
  "id", "name", "imageUrl", "slots", "priceUsdc", "active", "isDefault",
  "sortOrder", "farmBonusPct", "requireRareStarters", "requireMinOverwall",
  "createdAt", "updatedAt"
) VALUES
(
  '00000000-0000-4000-8000-000000000001',
  'Arena da Vila',
  '/ui/stadiums/arena-vila.png?v=7',
  '[
    {"id":"s001","label":"GOL","xPct":50,"yPct":88,"role":"GK","zIndex":1},
    {"id":"s002","label":"ZAG-1","xPct":22,"yPct":74,"role":"DEF","zIndex":2},
    {"id":"s003","label":"ZAG-2","xPct":38,"yPct":76,"role":"DEF","zIndex":3},
    {"id":"s004","label":"ZAG-3","xPct":62,"yPct":76,"role":"DEF","zIndex":4},
    {"id":"s005","label":"ZAG-4","xPct":78,"yPct":74,"role":"DEF","zIndex":5},
    {"id":"s006","label":"MEI-1","xPct":32,"yPct":62,"role":"MID","zIndex":6},
    {"id":"s007","label":"MEI-2","xPct":50,"yPct":60,"role":"MID","zIndex":7},
    {"id":"s008","label":"MEI-3","xPct":68,"yPct":62,"role":"MID","zIndex":8},
    {"id":"s009","label":"ATA-1","xPct":36,"yPct":54,"role":"FW","zIndex":9},
    {"id":"s010","label":"ATA-2","xPct":50,"yPct":52,"role":"FW","zIndex":10},
    {"id":"s011","label":"ATA-3","xPct":64,"yPct":54,"role":"FW","zIndex":11}
  ]'::jsonb,
  5, true, true, 0, 0.05, 11, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000002',
  'Estádio das Luzes',
  '/ui/stadiums/estadio-luzes.png?v=7',
  '[
    {"id":"s001","label":"GOL","xPct":50,"yPct":88,"role":"GK","zIndex":1},
    {"id":"s002","label":"ZAG-1","xPct":22,"yPct":74,"role":"DEF","zIndex":2},
    {"id":"s003","label":"ZAG-2","xPct":38,"yPct":76,"role":"DEF","zIndex":3},
    {"id":"s004","label":"ZAG-3","xPct":62,"yPct":76,"role":"DEF","zIndex":4},
    {"id":"s005","label":"ZAG-4","xPct":78,"yPct":74,"role":"DEF","zIndex":5},
    {"id":"s006","label":"MEI-1","xPct":32,"yPct":62,"role":"MID","zIndex":6},
    {"id":"s007","label":"MEI-2","xPct":50,"yPct":60,"role":"MID","zIndex":7},
    {"id":"s008","label":"MEI-3","xPct":68,"yPct":62,"role":"MID","zIndex":8},
    {"id":"s009","label":"ATA-1","xPct":36,"yPct":54,"role":"FW","zIndex":9},
    {"id":"s010","label":"ATA-2","xPct":50,"yPct":52,"role":"FW","zIndex":10},
    {"id":"s011","label":"ATA-3","xPct":64,"yPct":54,"role":"FW","zIndex":11}
  ]'::jsonb,
  6, true, false, 1, 0.06, 11, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000003',
  'Fortaleza Azul',
  '/ui/stadiums/fortaleza-azul.png?v=7',
  '[
    {"id":"s001","label":"GOL","xPct":50,"yPct":88,"role":"GK","zIndex":1},
    {"id":"s002","label":"ZAG-1","xPct":22,"yPct":74,"role":"DEF","zIndex":2},
    {"id":"s003","label":"ZAG-2","xPct":38,"yPct":76,"role":"DEF","zIndex":3},
    {"id":"s004","label":"ZAG-3","xPct":62,"yPct":76,"role":"DEF","zIndex":4},
    {"id":"s005","label":"ZAG-4","xPct":78,"yPct":74,"role":"DEF","zIndex":5},
    {"id":"s006","label":"MEI-1","xPct":32,"yPct":62,"role":"MID","zIndex":6},
    {"id":"s007","label":"MEI-2","xPct":50,"yPct":60,"role":"MID","zIndex":7},
    {"id":"s008","label":"MEI-3","xPct":68,"yPct":62,"role":"MID","zIndex":8},
    {"id":"s009","label":"ATA-1","xPct":36,"yPct":54,"role":"FW","zIndex":9},
    {"id":"s010","label":"ATA-2","xPct":50,"yPct":52,"role":"FW","zIndex":10},
    {"id":"s011","label":"ATA-3","xPct":64,"yPct":54,"role":"FW","zIndex":11}
  ]'::jsonb,
  7, true, false, 2, 0.07, 11, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000004',
  'Coliseu Imperial',
  '/ui/stadiums/coliseu-imperial.png?v=7',
  '[
    {"id":"s001","label":"GOL","xPct":50,"yPct":88,"role":"GK","zIndex":1},
    {"id":"s002","label":"ZAG-1","xPct":22,"yPct":74,"role":"DEF","zIndex":2},
    {"id":"s003","label":"ZAG-2","xPct":38,"yPct":76,"role":"DEF","zIndex":3},
    {"id":"s004","label":"ZAG-3","xPct":62,"yPct":76,"role":"DEF","zIndex":4},
    {"id":"s005","label":"ZAG-4","xPct":78,"yPct":74,"role":"DEF","zIndex":5},
    {"id":"s006","label":"MEI-1","xPct":32,"yPct":62,"role":"MID","zIndex":6},
    {"id":"s007","label":"MEI-2","xPct":50,"yPct":60,"role":"MID","zIndex":7},
    {"id":"s008","label":"MEI-3","xPct":68,"yPct":62,"role":"MID","zIndex":8},
    {"id":"s009","label":"ATA-1","xPct":36,"yPct":54,"role":"FW","zIndex":9},
    {"id":"s010","label":"ATA-2","xPct":50,"yPct":52,"role":"FW","zIndex":10},
    {"id":"s011","label":"ATA-3","xPct":64,"yPct":54,"role":"FW","zIndex":11}
  ]'::jsonb,
  8, true, false, 3, 0.08, 11, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
),
(
  '00000000-0000-4000-8000-000000000005',
  'Arena do Vulcão',
  '/ui/stadiums/arena-vulcao.png?v=7',
  '[
    {"id":"s001","label":"GOL","xPct":50,"yPct":88,"role":"GK","zIndex":1},
    {"id":"s002","label":"ZAG-1","xPct":22,"yPct":74,"role":"DEF","zIndex":2},
    {"id":"s003","label":"ZAG-2","xPct":38,"yPct":76,"role":"DEF","zIndex":3},
    {"id":"s004","label":"ZAG-3","xPct":62,"yPct":76,"role":"DEF","zIndex":4},
    {"id":"s005","label":"ZAG-4","xPct":78,"yPct":74,"role":"DEF","zIndex":5},
    {"id":"s006","label":"MEI-1","xPct":32,"yPct":62,"role":"MID","zIndex":6},
    {"id":"s007","label":"MEI-2","xPct":50,"yPct":60,"role":"MID","zIndex":7},
    {"id":"s008","label":"MEI-3","xPct":68,"yPct":62,"role":"MID","zIndex":8},
    {"id":"s009","label":"ATA-1","xPct":36,"yPct":54,"role":"FW","zIndex":9},
    {"id":"s010","label":"ATA-2","xPct":50,"yPct":52,"role":"FW","zIndex":10},
    {"id":"s011","label":"ATA-3","xPct":64,"yPct":54,"role":"FW","zIndex":11}
  ]'::jsonb,
  10, true, false, 4, 0.10, 11, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "imageUrl" = EXCLUDED."imageUrl",
  "slots" = EXCLUDED."slots",
  "priceUsdc" = EXCLUDED."priceUsdc",
  "active" = true,
  "isDefault" = EXCLUDED."isDefault",
  "sortOrder" = EXCLUDED."sortOrder",
  "farmBonusPct" = EXCLUDED."farmBonusPct",
  "requireRareStarters" = 11,
  "requireMinOverwall" = 0,
  "updatedAt" = CURRENT_TIMESTAMP;

-- Licenses are bought in USDC. This seed does not grant them.

-- Home XI for teste@mll.local (positions: 0 GK, 1 DEF, 2 MID, 3 FW)
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

INSERT INTO "ClubLineup" ("clubId", "stadiumTemplateId", "assignments", "updatedAt")
SELECT
  c.id,
  '00000000-0000-4000-8000-000000000001',
  '{
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
  CURRENT_TIMESTAMP
FROM "Club" c
JOIN "User" u ON u.id = c."userId"
WHERE u.email = 'teste@mll.local'
ON CONFLICT ("clubId") DO UPDATE SET
  "stadiumTemplateId" = EXCLUDED."stadiumTemplateId",
  "assignments" = EXCLUDED."assignments",
  "updatedAt" = CURRENT_TIMESTAMP;
