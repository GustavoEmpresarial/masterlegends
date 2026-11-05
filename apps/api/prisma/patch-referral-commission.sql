-- One row per deposit (or rejected signup). The hash is unique, so the same deposit cannot pay twice.

CREATE TABLE IF NOT EXISTS "ReferralCommission" (
  "id" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "referredId" TEXT NOT NULL,
  "purchaseType" VARCHAR(32) NOT NULL,
  "purchaseRef" VARCHAR(80) NOT NULL,
  "grossAmount" DECIMAL(36, 6) NOT NULL DEFAULT 0,
  "rate" DECIMAL(8, 4) NOT NULL DEFAULT 0,
  "commissionAmount" DECIMAL(36, 6) NOT NULL DEFAULT 0,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'usdc',
  "status" VARCHAR(16) NOT NULL,
  "history" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommission_purchaseType_purchaseRef_key"
  ON "ReferralCommission"("purchaseType", "purchaseRef");
CREATE INDEX IF NOT EXISTS "ReferralCommission_referrerId_createdAt_idx"
  ON "ReferralCommission"("referrerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralCommission_referredId_createdAt_idx"
  ON "ReferralCommission"("referredId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "ReferralCommission"
    ADD CONSTRAINT "ReferralCommission_referrerId_fkey"
    FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ReferralCommission"
    ADD CONSTRAINT "ReferralCommission_referredId_fkey"
    FOREIGN KEY ("referredId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
