-- CreateTable
CREATE TABLE "ZeradsPtcCallback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodKey" VARCHAR(32) NOT NULL,
    "zerAmount" DECIMAL(18,6) NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "overwall" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZeradsPtcCallback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ZeradsPtcCallback_userId_createdAt_idx" ON "ZeradsPtcCallback"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ZeradsPtcCallback_userId_periodKey_key" ON "ZeradsPtcCallback"("userId", "periodKey");

-- AddForeignKey
ALTER TABLE "ZeradsPtcCallback" ADD CONSTRAINT "ZeradsPtcCallback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
