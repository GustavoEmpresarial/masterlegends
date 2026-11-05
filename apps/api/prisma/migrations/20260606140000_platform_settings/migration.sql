-- AlterTable
ALTER TABLE "PlatformConfig"
  ADD COLUMN "registrationOpen" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maintenanceMessage" VARCHAR(500),
  ADD COLUMN "referralBonusPct" DECIMAL(8,4) NOT NULL DEFAULT 0.05;
