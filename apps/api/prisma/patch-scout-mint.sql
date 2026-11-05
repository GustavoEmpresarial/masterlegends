-- Scout mint: configurable rarity weights and one audit row per minted card.

ALTER TABLE "PlatformConfig"
  ADD COLUMN IF NOT EXISTS "scoutRarityWeights" JSONB NOT NULL
  DEFAULT '{"common":0.8482,"uncommon":0.1,"rare":0.15,"super-rare":0.0015,"epic":0.0002,"legendary":0.0001}';

CREATE TABLE IF NOT EXISTS "MintRecord" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "wallet" VARCHAR(42),
  "cost" DECIMAL(36, 6) NOT NULL,
  "basePlayerId" VARCHAR(64) NOT NULL,
  "rarity" INTEGER NOT NULL,
  "attributes" JSONB NOT NULL,
  "mgtTransactionId" TEXT NOT NULL REFERENCES "MGTTransaction"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MintRecord_userId_createdAt_idx" ON "MintRecord" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MintRecord_mgtTransactionId_idx" ON "MintRecord" ("mgtTransactionId");
CREATE INDEX IF NOT EXISTS "MintRecord_basePlayerId_idx" ON "MintRecord" ("basePlayerId");
