-- Escritório: configuração completa pelo admin (textos, perks, stamina, flags)
ALTER TABLE "PlatformConfig"
  ADD COLUMN "treasurerEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "coachEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "treasurerName" VARCHAR(64) NOT NULL DEFAULT 'Tesoureiro',
  ADD COLUMN "treasurerRoleLabel" VARCHAR(128) NOT NULL DEFAULT 'Diretor financeiro do clube',
  ADD COLUMN "treasurerAvatar" VARCHAR(8) NOT NULL DEFAULT '💼',
  ADD COLUMN "treasurerAccent" VARCHAR(32) NOT NULL DEFAULT 'var(--blue)',
  ADD COLUMN "treasurerPerks" JSONB NOT NULL DEFAULT '[{"icon":"◆","text":"Cargo simbólico — funções financeiras serão liberadas em breve."},{"icon":"◆","text":"Mantenha contratado para garantir o cargo antes dos benefícios chegarem."}]',
  ADD COLUMN "coachName" VARCHAR(64) NOT NULL DEFAULT 'Treinador',
  ADD COLUMN "coachRoleLabel" VARCHAR(128) NOT NULL DEFAULT 'Comandante técnico e fisioterapeuta',
  ADD COLUMN "coachAvatar" VARCHAR(8) NOT NULL DEFAULT '🎽',
  ADD COLUMN "coachAccent" VARCHAR(32) NOT NULL DEFAULT 'var(--gold)',
  ADD COLUMN "coachPerks" JSONB NOT NULL DEFAULT '[{"icon":"⚡","text":"Ativa a recuperação passiva de stamina no CT ({recoveryPerHour}+ por hora)."},{"icon":"⚠","text":"Cobra {miningFeePct}% sobre cada coleta de mineração/farm enquanto contratado."}]',
  ADD COLUMN "coachStaminaRecoveryPerHour" INTEGER NOT NULL DEFAULT 24;
