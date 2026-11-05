-- AlterTable
ALTER TABLE "StadiumTemplate" ADD COLUMN IF NOT EXISTS "requireRareStarters" INTEGER NOT NULL DEFAULT 11;
ALTER TABLE "StadiumTemplate" ADD COLUMN IF NOT EXISTS "requireMinOverwall" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "StadiumTemplate" ADD COLUMN IF NOT EXISTS "requireOwnedTemplateId" TEXT;
ALTER TABLE "StadiumTemplate" ADD COLUMN IF NOT EXISTS "requirementNote" VARCHAR(280);

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StadiumTemplate_requireOwnedTemplateId_fkey'
  ) THEN
    ALTER TABLE "StadiumTemplate"
      ADD CONSTRAINT "StadiumTemplate_requireOwnedTemplateId_fkey"
      FOREIGN KEY ("requireOwnedTemplateId") REFERENCES "StadiumTemplate"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
