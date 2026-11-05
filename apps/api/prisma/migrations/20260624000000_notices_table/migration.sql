-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "priority" VARCHAR(16) NOT NULL DEFAULT 'normal',
    "imageUrl" VARCHAR(512),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdBy" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notice_active_createdAt_idx" ON "Notice"("active", "createdAt");

-- CreateIndex
CREATE INDEX "Notice_category_idx" ON "Notice"("category");
