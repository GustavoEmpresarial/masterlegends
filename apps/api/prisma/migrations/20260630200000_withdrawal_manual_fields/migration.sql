ALTER TABLE "WithdrawalRequest" ADD COLUMN "requestedUsdc" DECIMAL(36,6);
ALTER TABLE "WithdrawalRequest" ADD COLUMN "feeUsdc" DECIMAL(36,6);

UPDATE "WithdrawalRequest" SET "requestedUsdc" = "amountUsdc", "feeUsdc" = 0 WHERE "requestedUsdc" IS NULL;

ALTER TABLE "WithdrawalRequest" ALTER COLUMN "requestedUsdc" SET NOT NULL;
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "feeUsdc" SET NOT NULL;
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "requestedUsdc" SET DEFAULT 0;
ALTER TABLE "WithdrawalRequest" ALTER COLUMN "feeUsdc" SET DEFAULT 0;
