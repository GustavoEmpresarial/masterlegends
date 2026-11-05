UPDATE "StadiumTemplate"
SET "slots" = '[
  {"id":"s001","label":"GOL","xPct":14,"yPct":50,"role":"GK","zIndex":1},
  {"id":"s002","label":"LAT-1","xPct":26,"yPct":24,"role":"LAT","zIndex":2},
  {"id":"s003","label":"ZAG-2","xPct":24,"yPct":42,"role":"DEF","zIndex":3},
  {"id":"s004","label":"ZAG-3","xPct":24,"yPct":58,"role":"DEF","zIndex":4},
  {"id":"s005","label":"LAT-2","xPct":26,"yPct":76,"role":"LAT","zIndex":5},
  {"id":"s006","label":"MEI-1","xPct":36,"yPct":32,"role":"MID","zIndex":6},
  {"id":"s007","label":"MEI-2","xPct":34,"yPct":50,"role":"MID","zIndex":7},
  {"id":"s008","label":"MEI-3","xPct":36,"yPct":68,"role":"MID","zIndex":8},
  {"id":"s009","label":"ATA-1","xPct":45,"yPct":28,"role":"FW","zIndex":9},
  {"id":"s010","label":"ATA-2","xPct":43,"yPct":50,"role":"FW","zIndex":10},
  {"id":"s011","label":"ATA-3","xPct":45,"yPct":72,"role":"FW","zIndex":11}
]'::jsonb,
"imageUrl" = '/ui/stadiums/arena-vila.png?v=6',
"updatedAt" = CURRENT_TIMESTAMP;

UPDATE "VestiarioTemplate"
SET "imageUrl" = '/ui/stadiums/arena-vila.png?v=6',
"slots" = '[
  {"id":"s001","label":"GOL","xPct":14,"yPct":50,"role":"GK","zIndex":1},
  {"id":"s002","label":"LAT-1","xPct":26,"yPct":24,"role":"LAT","zIndex":2},
  {"id":"s003","label":"ZAG-2","xPct":24,"yPct":42,"role":"DEF","zIndex":3},
  {"id":"s004","label":"ZAG-3","xPct":24,"yPct":58,"role":"DEF","zIndex":4},
  {"id":"s005","label":"LAT-2","xPct":26,"yPct":76,"role":"LAT","zIndex":5},
  {"id":"s006","label":"MEI-1","xPct":36,"yPct":32,"role":"MID","zIndex":6},
  {"id":"s007","label":"MEI-2","xPct":34,"yPct":50,"role":"MID","zIndex":7},
  {"id":"s008","label":"MEI-3","xPct":36,"yPct":68,"role":"MID","zIndex":8},
  {"id":"s009","label":"ATA-1","xPct":45,"yPct":28,"role":"FW","zIndex":9},
  {"id":"s010","label":"ATA-2","xPct":43,"yPct":50,"role":"FW","zIndex":10},
  {"id":"s011","label":"ATA-3","xPct":45,"yPct":72,"role":"FW","zIndex":11}
]'::jsonb,
"updatedAt" = CURRENT_TIMESTAMP;

UPDATE "BasePlayer" SET stamina = 100, "staminaUpdatedAt" = CURRENT_TIMESTAMP
WHERE id LIKE '00000000-0000-4000-8000-aa%';
