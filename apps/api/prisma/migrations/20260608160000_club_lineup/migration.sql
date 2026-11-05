-- CreateTable
CREATE TABLE "ClubLineup" (
    "clubId" TEXT NOT NULL,
    "stadiumTemplateId" TEXT NOT NULL,
    "assignments" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClubLineup_pkey" PRIMARY KEY ("clubId")
);

-- CreateIndex
CREATE INDEX "ClubLineup_stadiumTemplateId_idx" ON "ClubLineup"("stadiumTemplateId");

-- AddForeignKey
ALTER TABLE "ClubLineup" ADD CONSTRAINT "ClubLineup_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClubLineup" ADD CONSTRAINT "ClubLineup_stadiumTemplateId_fkey" FOREIGN KEY ("stadiumTemplateId") REFERENCES "StadiumTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
