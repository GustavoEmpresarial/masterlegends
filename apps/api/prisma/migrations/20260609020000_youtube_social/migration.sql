-- CreateTable
CREATE TABLE "YoutubeCreator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelName" VARCHAR(64) NOT NULL,
    "channelUrl" VARCHAR(255) NOT NULL,
    "description" VARCHAR(512) NOT NULL,
    "photoUrl" VARCHAR(512) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "rejectionReason" VARCHAR(512),
    "reviewedBy" VARCHAR(64),
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YoutubeCreator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YoutubeVideo" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "videoUrl" VARCHAR(255) NOT NULL,
    "videoId" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "weekStart" DATE NOT NULL,
    "rejectionReason" VARCHAR(512),
    "reviewedBy" VARCHAR(64),
    "reviewedAt" TIMESTAMP(3),
    "nftGrantedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YoutubeVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeCreator_userId_key" ON "YoutubeCreator"("userId");

-- CreateIndex
CREATE INDEX "YoutubeCreator_status_createdAt_idx" ON "YoutubeCreator"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "YoutubeVideo_creatorId_videoId_key" ON "YoutubeVideo"("creatorId", "videoId");

-- CreateIndex
CREATE INDEX "YoutubeVideo_creatorId_weekStart_idx" ON "YoutubeVideo"("creatorId", "weekStart");

-- CreateIndex
CREATE INDEX "YoutubeVideo_status_createdAt_idx" ON "YoutubeVideo"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "YoutubeCreator" ADD CONSTRAINT "YoutubeCreator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YoutubeVideo" ADD CONSTRAINT "YoutubeVideo_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "YoutubeCreator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
