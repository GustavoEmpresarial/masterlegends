-- Club: staff (Tesoureiro / Treinador)
ALTER TABLE "Club"
  ADD COLUMN "treasurerHiredAt" TIMESTAMP(3),
  ADD COLUMN "treasurerLastBilledAt" TIMESTAMP(3),
  ADD COLUMN "coachHiredAt" TIMESTAMP(3),
  ADD COLUMN "coachLastBilledAt" TIMESTAMP(3);

-- PlatformConfig: cobranças e fee do treinador
ALTER TABLE "PlatformConfig"
  ADD COLUMN "treasurerWeeklyUsdc" DECIMAL(36,6) NOT NULL DEFAULT 0,
  ADD COLUMN "coachWeeklyUsdc"     DECIMAL(36,6) NOT NULL DEFAULT 0,
  ADD COLUMN "coachMiningFeePct"   DECIMAL(8,4)  NOT NULL DEFAULT 0.02;
