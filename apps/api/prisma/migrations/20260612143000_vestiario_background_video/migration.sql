-- Vestiário: fundo pode ser imagem ou vídeo em loop (mp4/webm)
ALTER TABLE "VestiarioTemplate"
  ADD COLUMN IF NOT EXISTS "backgroundType" VARCHAR(8) NOT NULL DEFAULT 'image';
