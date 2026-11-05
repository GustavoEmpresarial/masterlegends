-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "paymentMethod" VARCHAR(16);
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "notes" VARCHAR(512);
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "requestIp" VARCHAR(64);
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "userAgent" VARCHAR(512);
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "browser" VARCHAR(64);
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "os" VARCHAR(64);
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "device" VARCHAR(32);
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Infer paymentMethod for completed rows that already have txHash
UPDATE "WithdrawalRequest"
SET "paymentMethod" = CASE
  WHEN "txHash" IS NOT NULL AND "txHash" <> '' THEN 'metamask'
  WHEN "status" = 'completed' THEN 'manual'
  ELSE "paymentMethod"
END
WHERE "status" = 'completed' AND "paymentMethod" IS NULL;

CREATE INDEX IF NOT EXISTS "WithdrawalRequest_wallet_idx" ON "WithdrawalRequest"("wallet");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_txHash_idx" ON "WithdrawalRequest"("txHash");
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_paymentMethod_createdAt_idx" ON "WithdrawalRequest"("paymentMethod", "createdAt");
