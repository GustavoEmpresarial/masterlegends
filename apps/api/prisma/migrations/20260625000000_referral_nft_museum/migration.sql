-- AddColumns BasePlayer: source, fieldedAt, expiresAt, retiredAt
ALTER TABLE "BasePlayer" ADD COLUMN "source" VARCHAR(32) NOT NULL DEFAULT 'scout';
ALTER TABLE "BasePlayer" ADD COLUMN "fieldedAt" TIMESTAMP(3);
ALTER TABLE "BasePlayer" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "BasePlayer" ADD COLUMN "retiredAt" TIMESTAMP(3);
CREATE INDEX "BasePlayer_expiresAt_idx" ON "BasePlayer"("expiresAt");

-- AddTable ClubTrophy
CREATE TABLE "ClubTrophy" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" VARCHAR(512),
    "imageUrl" VARCHAR(512),
    "wonAt" TIMESTAMP(3) NOT NULL,
    "grantedBy" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClubTrophy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ClubTrophy_clubId_idx" ON "ClubTrophy"("clubId");
ALTER TABLE "ClubTrophy" ADD CONSTRAINT "ClubTrophy_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddColumns PlatformConfig: referral NFT settings
ALTER TABLE "PlatformConfig" ADD COLUMN "referralNftName" VARCHAR(64) NOT NULL DEFAULT 'Craque Indicação';
ALTER TABLE "PlatformConfig" ADD COLUMN "referralNftImageUrl" VARCHAR(512);
ALTER TABLE "PlatformConfig" ADD COLUMN "referralNftOverwall" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "PlatformConfig" ADD COLUMN "referralNftPosition" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "PlatformConfig" ADD COLUMN "referralNftDurationDays" INTEGER NOT NULL DEFAULT 30;
