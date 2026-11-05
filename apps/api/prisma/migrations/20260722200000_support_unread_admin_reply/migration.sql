-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN "hasUnreadAdminReply" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "SupportTicket_userId_hasUnreadAdminReply_idx" ON "SupportTicket"("userId", "hasUnreadAdminReply");
