UPDATE "StadiumTemplate"
SET "slots" = '[
  {"id":"s001","label":"GOL","xPct":10,"yPct":50,"role":"GK","zIndex":1},
  {"id":"s002","label":"ZAG-1","xPct":20,"yPct":22,"role":"DEF","zIndex":2},
  {"id":"s003","label":"ZAG-2","xPct":18,"yPct":38,"role":"DEF","zIndex":3},
  {"id":"s004","label":"ZAG-3","xPct":18,"yPct":62,"role":"DEF","zIndex":4},
  {"id":"s005","label":"ZAG-4","xPct":20,"yPct":78,"role":"DEF","zIndex":5},
  {"id":"s006","label":"MEI-1","xPct":32,"yPct":28,"role":"MID","zIndex":6},
  {"id":"s007","label":"MEI-2","xPct":34,"yPct":50,"role":"MID","zIndex":7},
  {"id":"s008","label":"MEI-3","xPct":32,"yPct":72,"role":"MID","zIndex":8},
  {"id":"s009","label":"ATA-1","xPct":44,"yPct":26,"role":"FW","zIndex":9},
  {"id":"s010","label":"ATA-2","xPct":46,"yPct":50,"role":"FW","zIndex":10},
  {"id":"s011","label":"ATA-3","xPct":44,"yPct":74,"role":"FW","zIndex":11}
]'::jsonb,
"imageUrl" = regexp_replace("imageUrl", '\?v=[0-9]+$', '') || '?v=3',
"updatedAt" = CURRENT_TIMESTAMP
WHERE id IN (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005'
);
