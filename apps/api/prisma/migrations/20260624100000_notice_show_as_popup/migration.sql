-- AlterTable
ALTER TABLE "Notice" ADD COLUMN "showAsPopup" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Notice_showAsPopup_active_idx" ON "Notice"("showAsPopup", "active");
