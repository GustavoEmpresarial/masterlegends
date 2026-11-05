-- Escritório: cobrança do treinador passa a ser % sobre patrocínio (coach_fee).
-- Zera mensalidades USDC legadas no config padrão.
UPDATE "PlatformConfig"
SET
  "treasurerWeeklyUsdc" = 0,
  "coachWeeklyUsdc" = 0
WHERE id = 'default';
