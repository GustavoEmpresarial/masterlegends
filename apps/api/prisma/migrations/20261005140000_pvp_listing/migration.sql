CREATE TABLE "PvpListing" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "hostClubName" VARCHAR(32) NOT NULL,
    "tierId" VARCHAR(16) NOT NULL,
    "stakeGmt" DECIMAL(36,6) NOT NULL,
    "hostOverwall" DECIMAL(18,4) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'open',
    "challengerUserId" TEXT,
    "challengerClubName" VARCHAR(32),
    "challengerOverwall" DECIMAL(18,4),
    "winnerUserId" TEXT,
    "result" VARCHAR(16),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "PvpListing_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PvpListing_status_tierId_idx" ON "PvpListing"("status", "tierId");
CREATE INDEX "PvpListing_hostUserId_status_idx" ON "PvpListing"("hostUserId", "status");
CREATE UNIQUE INDEX "PvpListing_one_open_per_host" ON "PvpListing"("hostUserId") WHERE "status" = 'open';

ALTER TABLE "PvpListing" ADD CONSTRAINT "PvpListing_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PvpListing" ADD CONSTRAINT "PvpListing_challengerUserId_fkey" FOREIGN KEY ("challengerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
