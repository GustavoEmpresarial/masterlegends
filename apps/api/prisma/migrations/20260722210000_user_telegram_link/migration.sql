-- AlterTable
ALTER TABLE "User" ADD COLUMN "telegramChatId" VARCHAR(64),
ADD COLUMN "telegramLinkedAt" TIMESTAMP(3),
ADD COLUMN "telegramNotifyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramChatId_key" ON "User"("telegramChatId");
