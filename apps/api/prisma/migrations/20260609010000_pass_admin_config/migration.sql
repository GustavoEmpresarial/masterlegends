-- Pass seasons are fully configured by admin; empty/inactive = no pass in game.

ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "name" VARCHAR(64) NOT NULL DEFAULT 'Season';
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "premiumPriceUsdc" DECIMAL(18,6) NOT NULL DEFAULT 500;
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "levels" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "missions" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "Season" ALTER COLUMN "active" SET DEFAULT false;

-- Legacy auto-seeded seasons without config must not show as an active pass.
UPDATE "Season" SET "active" = false WHERE "levels" = '[]'::jsonb OR jsonb_array_length("levels") = 0;
