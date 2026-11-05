-- CreateTable
CREATE TABLE "CheckInGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 100,
    "checkInDay" DATE NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckInGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckInGrant_userId_expiresAt_idx" ON "CheckInGrant"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInGrant_userId_checkInDay_key" ON "CheckInGrant"("userId", "checkInDay");

-- AddForeignKey
ALTER TABLE "CheckInGrant" ADD CONSTRAINT "CheckInGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
