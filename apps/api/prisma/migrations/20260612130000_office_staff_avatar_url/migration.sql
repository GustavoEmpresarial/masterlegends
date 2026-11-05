-- Escritório: avatar pode ser emoji ou URL de imagem (/uploads/office/...)
ALTER TABLE "PlatformConfig"
  ALTER COLUMN "treasurerAvatar" TYPE VARCHAR(512),
  ALTER COLUMN "coachAvatar" TYPE VARCHAR(512);
