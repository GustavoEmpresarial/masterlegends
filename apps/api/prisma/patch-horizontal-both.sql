-- Horizontal pitch: home XI on the left, goals left/right.
UPDATE "StadiumTemplate"
SET "slots" = '[
  {"id":"s001","label":"GOL","xPct":8,"yPct":50,"role":"GK","zIndex":1},
  {"id":"s002","label":"ZAG-1","xPct":18,"yPct":18,"role":"DEF","zIndex":2},
  {"id":"s003","label":"ZAG-2","xPct":16,"yPct":38,"role":"DEF","zIndex":3},
  {"id":"s004","label":"ZAG-3","xPct":16,"yPct":62,"role":"DEF","zIndex":4},
  {"id":"s005","label":"ZAG-4","xPct":18,"yPct":82,"role":"DEF","zIndex":5},
  {"id":"s006","label":"MEI-1","xPct":30,"yPct":28,"role":"MID","zIndex":6},
  {"id":"s007","label":"MEI-2","xPct":32,"yPct":50,"role":"MID","zIndex":7},
  {"id":"s008","label":"MEI-3","xPct":30,"yPct":72,"role":"MID","zIndex":8},
  {"id":"s009","label":"ATA-1","xPct":42,"yPct":30,"role":"FW","zIndex":9},
  {"id":"s010","label":"ATA-2","xPct":44,"yPct":50,"role":"FW","zIndex":10},
  {"id":"s011","label":"ATA-3","xPct":42,"yPct":70,"role":"FW","zIndex":11}
]'::jsonb,
"imageUrl" = '/ui/stadiums/arena-vila.png?v=5',
"updatedAt" = CURRENT_TIMESTAMP;

UPDATE "VestiarioTemplate"
SET "imageUrl" = '/ui/stadiums/arena-vila.png?v=5',
"slots" = '[
  {"id":"s001","label":"GOL","xPct":8,"yPct":50,"role":"GK","zIndex":1},
  {"id":"s002","label":"ZAG-1","xPct":18,"yPct":18,"role":"DEF","zIndex":2},
  {"id":"s003","label":"ZAG-2","xPct":16,"yPct":38,"role":"DEF","zIndex":3},
  {"id":"s004","label":"ZAG-3","xPct":16,"yPct":62,"role":"DEF","zIndex":4},
  {"id":"s005","label":"ZAG-4","xPct":18,"yPct":82,"role":"DEF","zIndex":5},
  {"id":"s006","label":"MEI-1","xPct":30,"yPct":28,"role":"MID","zIndex":6},
  {"id":"s007","label":"MEI-2","xPct":32,"yPct":50,"role":"MID","zIndex":7},
  {"id":"s008","label":"MEI-3","xPct":30,"yPct":72,"role":"MID","zIndex":8},
  {"id":"s009","label":"ATA-1","xPct":42,"yPct":30,"role":"FW","zIndex":9},
  {"id":"s010","label":"ATA-2","xPct":44,"yPct":50,"role":"FW","zIndex":10},
  {"id":"s011","label":"ATA-3","xPct":42,"yPct":70,"role":"FW","zIndex":11}
]'::jsonb,
"updatedAt" = CURRENT_TIMESTAMP;

UPDATE "BasePlayer"
SET stamina = 100, "staminaUpdatedAt" = CURRENT_TIMESTAMP
WHERE id LIKE '00000000-0000-4000-8000-aa%';

UPDATE "ClubLineup"
SET assignments = '{
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
"updatedAt" = CURRENT_TIMESTAMP;
