-- CreateTable
CREATE TABLE "StadiumTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "imageUrl" VARCHAR(512) NOT NULL,
    "slots" JSONB NOT NULL,
    "priceUsdc" DECIMAL(18,6),
    "active" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StadiumTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StadiumTemplate_active_sortOrder_idx" ON "StadiumTemplate"("active", "sortOrder");

-- Seed default stadium template (image uploaded separately to uploads/stadiums/)
INSERT INTO "StadiumTemplate" (
    "id",
    "name",
    "imageUrl",
    "slots",
    "priceUsdc",
    "active",
    "isDefault",
    "sortOrder",
    "createdAt",
    "updatedAt"
) VALUES (
    '00000000-0000-4000-8000-000000000001',
    'Estádio Neon Default',
    '/uploads/stadiums/default.png',
    '[
      {"id":"s001","label":"GOL","xPct":50,"yPct":82,"role":"GK","zIndex":1},
      {"id":"s002","label":"ZAG-1","xPct":28,"yPct":68,"role":"DEF","zIndex":2},
      {"id":"s003","label":"ZAG-2","xPct":42,"yPct":70,"role":"DEF","zIndex":3},
      {"id":"s004","label":"ZAG-3","xPct":58,"yPct":70,"role":"DEF","zIndex":4},
      {"id":"s005","label":"ZAG-4","xPct":72,"yPct":68,"role":"DEF","zIndex":5},
      {"id":"s006","label":"MEI-1","xPct":35,"yPct":52,"role":"MID","zIndex":6},
      {"id":"s007","label":"MEI-2","xPct":50,"yPct":50,"role":"MID","zIndex":7},
      {"id":"s008","label":"MEI-3","xPct":65,"yPct":52,"role":"MID","zIndex":8},
      {"id":"s009","label":"ATA-1","xPct":38,"yPct":32,"role":"FW","zIndex":9},
      {"id":"s010","label":"ATA-2","xPct":50,"yPct":28,"role":"FW","zIndex":10},
      {"id":"s011","label":"ATA-3","xPct":62,"yPct":32,"role":"FW","zIndex":11}
    ]'::jsonb,
    NULL,
    true,
    true,
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
