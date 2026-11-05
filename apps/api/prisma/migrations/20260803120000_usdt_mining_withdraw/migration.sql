-- Economia a partir de 01/08/2026: mineração e saques passam a ser pagos em USDT.
-- Depósitos continuam em USDC; economia interna continua em GMT.

-- 1) Novo saldo estável USDT (ganhos de mineração / sacável) em MGTBalance
ALTER TABLE "MGTBalance" ADD COLUMN IF NOT EXISTS "usdtAmount" DECIMAL(36,18) NOT NULL DEFAULT 0;

-- 2) Moeda por linha nas tabelas de saque e recompensa de mineração
ALTER TABLE "WithdrawalRequest" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(8) NOT NULL DEFAULT 'usdt';
ALTER TABLE "MiningReward" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(8) NOT NULL DEFAULT 'usdt';

-- 3) Registros legados foram liquidados em USDC — preserva a moeda histórica.
UPDATE "WithdrawalRequest" SET "currency" = 'usdc';
UPDATE "MiningReward" SET "currency" = 'usdc';

-- NOTA: NÃO fazer cutover/data-move de usdcAmount -> usdtAmount.
-- usdcAmount é o saldo depositado pelo usuário e nunca deve ser deslocado.
-- usdtAmount começa em 0 (default da coluna) e só acumula a partir de agora,
-- via crédito de mineração real (mining.worker.ts / applyUsdtCredit).
