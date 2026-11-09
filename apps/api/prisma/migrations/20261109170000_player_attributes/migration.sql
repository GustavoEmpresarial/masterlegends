-- Columns and tables that production received from patch scripts, missing from migrate history.
-- Fresh CI databases otherwise reject player creation and later queries.
-- IF NOT EXISTS / duplicate_object so a database that already has the patch still migrates.

ALTER TABLE "BasePlayer" ADD COLUMN IF NOT EXISTS "attributes" JSONB;
ALTER TABLE "PlayerCache" ADD COLUMN IF NOT EXISTS "attributes" JSONB;

ALTER TABLE "MGTBalance" ADD COLUMN IF NOT EXISTS "lockedAmount" DECIMAL(36,18) NOT NULL DEFAULT 0;
ALTER TABLE "MGTBalance" ADD COLUMN IF NOT EXISTS "usdtLockedAmount" DECIMAL(36,18) NOT NULL DEFAULT 0;

ALTER TABLE "MiningBlock" ADD COLUMN IF NOT EXISTS "residualUsdt" DECIMAL(36,6) NOT NULL DEFAULT 0;

ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "dailyRestStamina" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "matchCooldownSec" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "matchStaminaCost" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "scoutRarityWeights" JSONB NOT NULL DEFAULT '{"common":50,"uncommon":30,"rare":10,"super-rare":6,"epic":3,"legendary":1}';
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "specialStaminaCost" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "PlatformConfig" ADD COLUMN IF NOT EXISTS "trainingStaminaCost" INTEGER NOT NULL DEFAULT 8;

CREATE TABLE IF NOT EXISTS "StaminaLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerKind" VARCHAR(8) NOT NULL,
    "playerId" VARCHAR(64) NOT NULL,
    "reason" VARCHAR(16) NOT NULL,
    "delta" INTEGER NOT NULL,
    "before" INTEGER NOT NULL,
    "after" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaminaLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CtRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "playerKind" VARCHAR(8),
    "playerId" VARCHAR(64),
    "kind" VARCHAR(16) NOT NULL,
    "before" INTEGER,
    "after" INTEGER,
    "detail" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CtRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MergeRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wallet" VARCHAR(42),
    "cost" DECIMAL(36,6) NOT NULL,
    "sources" JSONB NOT NULL,
    "overwallBefore" INTEGER NOT NULL,
    "resultPlayerId" VARCHAR(64) NOT NULL,
    "overwallAfter" INTEGER NOT NULL,
    "mgtTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MergeRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MintRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wallet" VARCHAR(42),
    "cost" DECIMAL(36,6) NOT NULL,
    "basePlayerId" VARCHAR(64) NOT NULL,
    "rarity" INTEGER NOT NULL,
    "attributes" JSONB NOT NULL,
    "mgtTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MintRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralCommission" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "purchaseType" VARCHAR(32) NOT NULL,
    "purchaseRef" VARCHAR(80) NOT NULL,
    "grossAmount" DECIMAL(36,6) NOT NULL DEFAULT 0,
    "rate" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "commissionAmount" DECIMAL(36,6) NOT NULL DEFAULT 0,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'usdc',
    "status" VARCHAR(16) NOT NULL,
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StaminaLedger_userId_createdAt_idx" ON "StaminaLedger"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "StaminaLedger_playerKind_playerId_createdAt_idx" ON "StaminaLedger"("playerKind", "playerId", "createdAt");
CREATE INDEX IF NOT EXISTS "CtRecord_userId_createdAt_idx" ON "CtRecord"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "CtRecord_playerKind_playerId_createdAt_idx" ON "CtRecord"("playerKind", "playerId", "createdAt");
CREATE INDEX IF NOT EXISTS "MergeRecord_userId_createdAt_idx" ON "MergeRecord"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MergeRecord_mgtTransactionId_idx" ON "MergeRecord"("mgtTransactionId");
CREATE INDEX IF NOT EXISTS "MergeRecord_resultPlayerId_idx" ON "MergeRecord"("resultPlayerId");
CREATE INDEX IF NOT EXISTS "MintRecord_userId_createdAt_idx" ON "MintRecord"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "MintRecord_mgtTransactionId_idx" ON "MintRecord"("mgtTransactionId");
CREATE INDEX IF NOT EXISTS "MintRecord_basePlayerId_idx" ON "MintRecord"("basePlayerId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_referrerId_createdAt_idx" ON "ReferralCommission"("referrerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralCommission_referredId_createdAt_idx" ON "ReferralCommission"("referredId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommission_purchaseType_purchaseRef_key" ON "ReferralCommission"("purchaseType", "purchaseRef");
CREATE INDEX IF NOT EXISTS "OfferwallReward_transactionId_idx" ON "OfferwallReward"("transactionId");

ALTER TABLE "UserIpEvent" DROP CONSTRAINT IF EXISTS "UserIpEvent_userId_fkey";
ALTER TABLE "UserIpEvent" ADD CONSTRAINT "UserIpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DO $$ BEGIN
  ALTER TABLE "StaminaLedger" ADD CONSTRAINT "StaminaLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CtRecord" ADD CONSTRAINT "CtRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MergeRecord" ADD CONSTRAINT "MergeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MergeRecord" ADD CONSTRAINT "MergeRecord_mgtTransactionId_fkey" FOREIGN KEY ("mgtTransactionId") REFERENCES "MGTTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MintRecord" ADD CONSTRAINT "MintRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MintRecord" ADD CONSTRAINT "MintRecord_mgtTransactionId_fkey" FOREIGN KEY ("mgtTransactionId") REFERENCES "MGTTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
