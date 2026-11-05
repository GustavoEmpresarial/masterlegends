-- Estoque oficial de cartas da liga no marketplace.
CREATE TABLE "MarketSupply" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "initialQty" INTEGER NOT NULL,
    "remaining" INTEGER NOT NULL,
    "priceGmt" DECIMAL(36,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketSupply_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketSupply_templateId_key" ON "MarketSupply"("templateId");
CREATE INDEX "MarketSupply_remaining_idx" ON "MarketSupply"("remaining");

ALTER TABLE "MarketSupply"
  ADD CONSTRAINT "MarketSupply_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "ItemTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
