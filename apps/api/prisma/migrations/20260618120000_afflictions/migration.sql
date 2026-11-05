-- CreateTable
CREATE TABLE "Affliction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetKind" VARCHAR(16) NOT NULL,
    "targetId" VARCHAR(64),
    "code" VARCHAR(64) NOT NULL,
    "note" VARCHAR(255),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdBy" VARCHAR(64),

    CONSTRAINT "Affliction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Affliction_userId_targetKind_expiresAt_idx" ON "Affliction"("userId", "targetKind", "expiresAt");

-- CreateIndex
CREATE INDEX "Affliction_expiresAt_idx" ON "Affliction"("expiresAt");

-- AddForeignKey
ALTER TABLE "Affliction" ADD CONSTRAINT "Affliction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
