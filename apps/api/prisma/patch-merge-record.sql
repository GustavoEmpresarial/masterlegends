-- Fusion audit: one row per fuse, with the burned cards and both OVERWALL figures.

CREATE TABLE IF NOT EXISTS "MergeRecord" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "wallet" VARCHAR(42),
  "cost" DECIMAL(36, 6) NOT NULL,
  "sources" JSONB NOT NULL,
  "overwallBefore" INTEGER NOT NULL,
  "resultPlayerId" VARCHAR(64) NOT NULL,
  "overwallAfter" INTEGER NOT NULL,
  "mgtTransactionId" TEXT NOT NULL REFERENCES "MGTTransaction"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MergeRecord_userId_createdAt_idx" ON "MergeRecord" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MergeRecord_mgtTransactionId_idx" ON "MergeRecord" ("mgtTransactionId");
CREATE INDEX IF NOT EXISTS "MergeRecord_resultPlayerId_idx" ON "MergeRecord" ("resultPlayerId");
