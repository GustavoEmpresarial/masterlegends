-- Training center evolution log: finished sessions, attribute steps, building upgrades.

CREATE TABLE IF NOT EXISTS "CtRecord" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "playerKind" VARCHAR(8),
  "playerId" VARCHAR(64),
  "kind" VARCHAR(16) NOT NULL,
  "before" INTEGER,
  "after" INTEGER,
  "detail" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CtRecord_userId_createdAt_idx" ON "CtRecord" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CtRecord_playerKind_playerId_createdAt_idx" ON "CtRecord" ("playerKind", "playerId", "createdAt");
