-- CreateTable
CREATE TABLE "EventOverwallGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "periodKey" VARCHAR(32) NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOverwallGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventTriggerCooldown" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "trigger" VARCHAR(64) NOT NULL,
    "dayKey" VARCHAR(10) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventTriggerCooldown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventOverwallGrant_userId_expiresAt_idx" ON "EventOverwallGrant"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "EventOverwallGrant_expiresAt_idx" ON "EventOverwallGrant"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventOverwallGrant_userId_questId_periodKey_lineIndex_key" ON "EventOverwallGrant"("userId", "questId", "periodKey", "lineIndex");

-- CreateIndex
CREATE INDEX "EventTriggerCooldown_userId_trigger_idx" ON "EventTriggerCooldown"("userId", "trigger");

-- CreateIndex
CREATE UNIQUE INDEX "EventTriggerCooldown_userId_trigger_dayKey_key" ON "EventTriggerCooldown"("userId", "trigger", "dayKey");

-- AddForeignKey
ALTER TABLE "EventOverwallGrant" ADD CONSTRAINT "EventOverwallGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventTriggerCooldown" ADD CONSTRAINT "EventTriggerCooldown_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
