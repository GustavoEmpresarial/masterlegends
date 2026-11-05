-- Stamina costs, daily rest amount, match cooldown, and the change history.

ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "dailyRestStamina" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "matchStaminaCost" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "matchCooldownSec" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "trainingStaminaCost" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "specialStaminaCost" INTEGER NOT NULL DEFAULT 5;

CREATE TABLE IF NOT EXISTS "StaminaLedger" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "playerKind" VARCHAR(8) NOT NULL,
  "playerId" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(16) NOT NULL,
  "delta" INTEGER NOT NULL,
  "before" INTEGER NOT NULL,
  "after" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "StaminaLedger_userId_createdAt_idx" ON "StaminaLedger" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "StaminaLedger_playerKind_playerId_createdAt_idx" ON "StaminaLedger" ("playerKind", "playerId", "createdAt");
