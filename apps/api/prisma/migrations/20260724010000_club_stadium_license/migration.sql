-- Licenças de campo (compra USDC + assinatura de contrato no Escritório)
CREATE TABLE "ClubStadiumLicense" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "stadiumTemplateId" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "pricePaidUsdc" DECIMAL(18,6),
    "purchasedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "contractVersion" VARCHAR(32),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubStadiumLicense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClubStadiumLicense_clubId_stadiumTemplateId_key" ON "ClubStadiumLicense"("clubId", "stadiumTemplateId");
CREATE INDEX "ClubStadiumLicense_clubId_status_idx" ON "ClubStadiumLicense"("clubId", "status");

ALTER TABLE "ClubStadiumLicense" ADD CONSTRAINT "ClubStadiumLicense_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClubStadiumLicense" ADD CONSTRAINT "ClubStadiumLicense_stadiumTemplateId_fkey" FOREIGN KEY ("stadiumTemplateId") REFERENCES "StadiumTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
