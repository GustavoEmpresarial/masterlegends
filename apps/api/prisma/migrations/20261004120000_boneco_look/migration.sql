CREATE TABLE "BonecoLook" (
    "userId" TEXT NOT NULL,
    "imageUrl" VARCHAR(512) NOT NULL,
    "position" VARCHAR(8) NOT NULL,
    "kit" VARCHAR(16) NOT NULL,
    "trim" VARCHAR(16) NOT NULL,
    "pose" VARCHAR(24) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonecoLook_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "BonecoLook" ADD CONSTRAINT "BonecoLook_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
