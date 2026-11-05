-- Multi-vestiário: adds name, active, isDefault, sortOrder, createdAt
-- The existing singleton row (id='default') is preserved and marked as default.

ALTER TABLE "VestiarioTemplate"
  ADD COLUMN IF NOT EXISTS "name"      VARCHAR(64)  NOT NULL DEFAULT 'Vestiário Padrão',
  ADD COLUMN IF NOT EXISTS "active"    BOOLEAN      NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Mark the existing default row
UPDATE "VestiarioTemplate" SET "isDefault" = true WHERE id = 'default';

-- Allow any UUID as id going forward (existing row keeps 'default' which is valid text PK)
CREATE INDEX IF NOT EXISTS "VestiarioTemplate_active_sortOrder_idx"
  ON "VestiarioTemplate"("active", "sortOrder");
