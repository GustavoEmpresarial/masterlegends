-- Mandatory onboarding tutorial flag (null = must complete for new users).
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tutorialCompletedAt" TIMESTAMP(3);

-- Existing accounts skip the mandatory first-run gate.
UPDATE "User"
SET "tutorialCompletedAt" = COALESCE("emailVerifiedAt", "createdAt")
WHERE "tutorialCompletedAt" IS NULL;
