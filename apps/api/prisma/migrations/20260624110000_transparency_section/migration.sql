-- CreateTable
CREATE TABLE "TransparencySection" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" VARCHAR(512),
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransparencySection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransparencySection_order_idx" ON "TransparencySection"("order");
