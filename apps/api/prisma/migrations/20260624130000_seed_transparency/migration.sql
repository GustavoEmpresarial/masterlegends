-- Seed default TransparencySection content
-- Uses INSERT ... WHERE NOT EXISTS so it's safe to re-run

INSERT INTO "TransparencySection" ("id", "title", "body", "imageUrl", "order", "visible", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  title,
  body,
  NULL,
  ord,
  true,
  NOW(),
  NOW()
FROM (VALUES
  (0, 'Sobre o Master Legends League',
   E'O **Master Legends League (MLL)** é uma plataforma de futebol de fantasia baseada em blockchain, onde jogadores compram, gerenciam e competem com times formados por cartas NFT de jogadores reais.\n\nNossa missão é criar um ecossistema transparente, justo e sustentável para toda a comunidade.\n\n- Plataforma lançada em 2025\n- Operado pela equipe MLL com sede no Brasil\n- Smart contracts auditados e de código aberto\n- Comunidade ativa no Discord e Telegram'),

  (1, 'Tokenomics & Distribuição',
   E'## Token MGT (Master Game Token)\n\nO MGT é o token nativo do ecossistema MLL, utilizado para recompensas, staking e governança.\n\n### Distribuição Total: 100.000.000 MGT\n\n- **40%** — Recompensas de jogadores (distribuídas ao longo de 4 anos)\n- **20%** — Reserva do ecossistema (operações e desenvolvimento)\n- **20%** — Time e fundadores (vesting de 36 meses)\n- **10%** — Parceiros estratégicos\n- **10%** — Liquidez inicial\n\n### USDC\nO USDC (USD Coin) é usado para compras no marketplace e depósitos. Todos os depósitos são registrados on-chain e verificáveis publicamente.'),

  (2, 'Endereços dos Smart Contracts',
   E'Todos os contratos do MLL estão deployados na **Polygon (chain 137)** e são publicamente verificáveis no Polygonscan.\n\n### Vault de Depósitos USDC\n`0x967659a8Fe5C15728eD900eF9a90c44bE20190f3`\n\n### USDC Nativo (Polygon)\n`0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359`\n\nQualquer pessoa pode consultar o saldo do vault em tempo real em [polygonscan.com](https://polygonscan.com/address/0x967659a8Fe5C15728eD900eF9a90c44bE20190f3).'),

  (3, 'Saques & Liquidez',
   E'## Política de Saques\n\nTodos os saques de USDC são processados manualmente pela equipe MLL em até **72 horas úteis**.\n\n### Processo\n1. Usuário solicita saque pelo painel\n2. Equipe verifica autenticidade e saldo\n3. Transferência executada on-chain via Polygon\n4. Hash da transação disponibilizado ao usuário\n\n### Limites\n- Saque mínimo: **10 USDC**\n- Saque máximo por dia: **10.000 USDC** (por conta)\n- KYC obrigatório para saques acima de **1.000 USDC**\n\n### Reserva de Liquidez\nMantemos 100% dos depósitos em USDC no vault auditável. Nenhum fundo é utilizado para operações internas.'),

  (4, 'Taxas & Receitas',
   E'## Estrutura de Taxas\n\nA plataforma MLL é sustentada por taxas transparentes aplicadas nas operações:\n\n| Operação | Taxa |\n|----------|------|\n| Venda no marketplace | 5% |\n| Scout (abertura de carta) | Incluído no preço |\n| Torneios PvP | 10% do prêmio |\n| Staking MGT | Gratuito |\n\n### Destino das Taxas\n- **50%** — Recompensas do pool de jogadores\n- **30%** — Operações e infraestrutura\n- **20%** — Reserva de crescimento do ecossistema\n\nTodas as taxas são aplicadas automaticamente via smart contract ou lógica auditada do servidor.')
) AS t(ord, title, body)
WHERE NOT EXISTS (SELECT 1 FROM "TransparencySection" LIMIT 1);
