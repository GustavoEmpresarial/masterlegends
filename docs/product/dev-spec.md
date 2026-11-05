# Master Legends League — Spec de Implementação (Dev)

> Documento operacional para o time de desenvolvimento executar o MVP da Master Legends League.
> Referência funcional: `whitepaper.md` e `whitepapper.pdf` na raiz do projeto.

---

## 0. Visão Geral Técnica

| Item | Decisão |
|---|---|
| Blockchain | Polygon PoS (mainnet) + Mumbai (testnet) |
| Padrões | ERC-721 (NFTs), ERC-20 (MGT) |
| Moeda de pagamento | USDC (Polygon nativo) |
| Carteira | Metamask (V1) + WalletConnect |
| RNG | Chainlink VRF v2 |
| Backend | Node.js 20 + TypeScript + Express/Fastify |
| Banco | PostgreSQL 15 + Redis (cache/sessões) |
| Frontend | React 18 + Vite + TailwindCSS + ethers.js v6 |
| Hospedagem | Vercel (front) + Railway/Render (back) + IPFS via Pinata |
| Auditoria | CertiK / Hacken antes do TGE |

---

## 1. Smart Contracts (Solidity ^0.8.24)

### 1.1. `MLLPlayerNFT.sol` (ERC-721)

**Função:** representar os atletas NFT.

**Estrutura de dados on-chain por token:**
```solidity
struct PlayerData {
    uint8 rarity;        // 0=Comum, 1=Raro, 2=SuperRaro, 3=Epico, 4=Lendario
    uint32 overwall;     // valor base do atleta
    uint8 stamina;       // 0-100
    uint8 position;      // 0=GOL,1=ZAG,2=MEI,3=ATA
    uint64 mintedAt;
    bytes32 traitsHash;  // hash de traits especiais armazenadas no IPFS
}
mapping(uint256 => PlayerData) public players;
```

**Funções principais:**
- `mint(address to, uint256 vrfRequestId)` — apenas chamada pelo `ScoutEngine`
- `burn(uint256 tokenId)` — apenas chamada pelo `BurnEngine`
- `updateStamina(uint256 tokenId, uint8 newStamina)` — autorizada via role
- `tokenURI(uint256)` — aponta para IPFS `ipfs://<CID>/<rarity>/<id>.json`

**Roles (AccessControl):**
- `MINTER_ROLE` → ScoutEngine
- `BURNER_ROLE` → BurnEngine
- `GAME_ROLE` → backend para atualizar stamina

### 1.2. `MGTToken.sol` (ERC-20)

- Nome: `Master Goal Token`
- Símbolo: `MGT`
- Decimais: 18
- Supply máximo (hard cap): **1.000.000.000 MGT**
- Mint inicial: 80.000.000 MGT (8%) para tesouraria multisig
- Mint contínuo: apenas `RewardsPool` via `MINTER_ROLE`

### 1.3. `ScoutEngine.sol` (mintagem)

**Responsabilidade:** receber 10 USDC do usuário, solicitar randomness ao Chainlink VRF, distribuir raridade conforme tabela e chamar `MLLPlayerNFT.mint()`.

```
Chances (basis points de 10000):
  Comum:       7500
  Raro:        1500
  Super Raro:   700
  Épico:        250
  Lendário:      50
```

**Fluxo:**
1. `requestMint(uint8 quantity)` — usuário aprova `quantity * 10 USDC`
2. Contrato puxa USDC e divide segundo seção 1.5
3. Solicita random word ao Chainlink VRF
4. Callback `fulfillRandomWords` calcula raridade + overwall dentro da faixa
5. Emite evento `PlayerMinted(tokenId, owner, rarity, overwall)`

**Faixas de OVERWALL por raridade (mint inicial sorteia uniformemente na faixa):**

| Raridade | Min | Max |
|---|---|---|
| Comum | 400 | 500 |
| Raro | 1000 | 2000 |
| Super Raro | 10000 | 12000 |
| Épico | 50000 | 62000 |
| Lendário | 160000 | 173000 |

### 1.4. `BurnEngine.sol` (fusão 5→1)

**Função:** receber 5 NFTs de raridade N e mintar 1 de raridade N+1.

```solidity
function fuse(uint256[5] calldata tokenIds) external {
    // valida: msg.sender é owner dos 5, todos mesma raridade, raridade < 4
    // queima os 5
    // mint novo com raridade+1 e overwall sorteado na faixa nova
}
```

Emite `PlayersFused(burnedIds[5], newTokenId, newRarity)`.

### 1.5. Distribuição da Receita de Mint (USDC)

A cada 10 USDC recebido pelo `ScoutEngine`:

| Destino | Endereço (multisig) | % | USDC |
|---|---|---|---|
| Rewards Pool | `0x...REWARDS` | 61% | 6.10 |
| Dev & Ops | `0x...DEVOPS` | 18% | 1.80 |
| Marketing | `0x...MKT` | 13% | 1.30 |
| Liquidez & Airdrops | `0x...LIQ` | 4% | 0.40 |
| Reserva Estratégica | `0x...RES` | 4% | 0.40 |

### 1.6. `Marketplace.sol`

- Order book on-chain de NFTs em USDC.
- Funções: `listItem(tokenId, price)`, `buyItem(listingId)`, `cancelListing(listingId)`.
- **Fee: 2%** do `price` enviada para `RewardsPool`.
- **Restrição:** apenas NFTs com `rarity >= 1` (Comuns bloqueados). Jogadores da Base não são NFT.
- Validação on-chain de faixas min/max para evitar lavagem:

| Raridade | Min USDC | Max USDC |
|---|---|---|
| Raro | 35 | 45 |
| Super Raro | 180 | 225 |
| Épico | 900 | 1150 |
| Lendário | 5000 | 6000 |

### 1.7. `StakingVault.sol`

- Stake de MGT com APR alvo de **18% ao ano** no primeiro ano.
- Recompensas pagas via `RewardsPool`.
- Período mínimo: 30 dias. Saída antecipada: 50% de penalidade do reward acumulado.

### 1.8. `RewardsPool.sol`

- Recebe USDC do ScoutEngine e Marketplace.
- Distribui MGT/USDC para: staking, missões, passe gratuito, PvP, F2P.
- Controlado pelo backend via `GAME_ROLE` com whitelisting de endereços de recompensa.

### 1.9. Padrões de Segurança

- OpenZeppelin Contracts v5.x
- ReentrancyGuard em todas as funções com transferências
- Pausable nos contratos principais (apenas role `PAUSER`)
- AccessControl em vez de Ownable
- Timelock de 48h em upgrades (UUPS) e mudanças de role
- Multisig Gnosis Safe 3-de-5 para todos os roles administrativos

---

## 2. Backend (Node.js + TypeScript)

### 2.1. Stack

- Fastify ou NestJS
- TypeScript strict mode
- Prisma ORM
- PostgreSQL 15
- Redis 7 (cache + queue BullMQ)
- ethers.js v6 para integração on-chain
- Sentry para observabilidade

### 2.2. Modelos de Banco (Prisma schema simplificado)

```prisma
model User {
  id            String  @id @default(uuid())
  wallet        String  @unique
  referralCode  String  @unique
  referredBy    String?
  createdAt     DateTime @default(now())
  club          Club?
  passProgress  PassProgress[]
}

model Club {
  id           String @id @default(uuid())
  userId       String @unique
  name         String
  stadiumLvl   Int    @default(1)
  ctLvl        Int    @default(1)
  treasurerLvl Int    @default(1)
  trophyRoomLvl Int   @default(1)
  totalOverwall Int   @default(0)
}

model PlayerCache {  // espelho off-chain do NFT para queries rápidas
  tokenId      BigInt @id
  ownerWallet  String
  rarity       Int
  overwall     Int
  stamina      Int
  position     Int
  staminaUpdatedAt DateTime
}

model BasePlayer {  // F2P, não-NFT
  id        String @id @default(uuid())
  userId    String
  overwall  Int
  position  Int
}

model MGTBalance {
  userId   String @id
  amount   Decimal @db.Decimal(36,18)
}

model PvPMatch {
  id        String @id @default(uuid())
  clubA     String
  clubB     String
  resultJson Json
  winner    String
  playedAt  DateTime @default(now())
}

model Season {
  id        Int @id
  startsAt  DateTime
  endsAt    DateTime
  active    Boolean
}

model PassProgress {
  userId    String
  seasonId  Int
  xp        Int @default(0)
  premium   Boolean @default(false)
  claimedLevels Int[]
  @@id([userId, seasonId])
}

model Referral {
  referrerId String
  referredId String @unique
  totalEarnedMGT Decimal @default(0) @db.Decimal(36,18)
  createdAt DateTime @default(now())
}
```

### 2.3. Endpoints Principais (REST)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/nonce` | Retorna nonce para SIWE |
| POST | `/auth/verify` | Verifica assinatura, emite JWT |
| GET | `/me` | Dados do usuário + clube |
| POST | `/club/create` | Cria clube (nome) |
| GET | `/club/inventory` | Lista NFTs + BasePlayers |
| POST | `/club/upgrade/:building` | Upgrade de Estádio/CT/Tesoureiro/Sala |
| GET | `/scout/price` | Preço atual de mint |
| POST | `/scout/mint` | Inicia fluxo de mint (retorna calldata) |
| POST | `/marketplace/list` | Cria listing |
| GET | `/marketplace/search` | Filtros: rarity, overwallMin, position, priceMax |
| POST | `/pvp/match` | Matchmaking + execução do confronto |
| POST | `/pvp/use-booster` | Usa booster na rodada atual |
| GET | `/pass/progress` | Progresso do passe |
| POST | `/pass/claim/:level` | Resgata recompensa |
| POST | `/minigames/:id/play` | Executa minigame, retorna XP+MGT |
| GET | `/merger/rules` | Regras de fusão off-chain (10→1, taxa 0) |
| POST | `/merger/fuse` | Fusão off-chain (10 `playerIds` BasePlayer) |
| POST | `/burn/fuse` | Inicia fusão on-chain (5 tokenIds — `BurnEngine`) |
| GET | `/referrals/stats` | Estatísticas do programa |

### 2.4. Workers (BullMQ)

- `stamina-recovery` — cron a cada 10min, restaura X stamina conforme nível do CT
- `season-reset` — cron diário verifica fim de temporada
- `chain-indexer` — escuta eventos on-chain e atualiza cache
- `referral-rewards` — calcula 5% do farm dos referidos e credita
- `vrf-finalizer` — escuta VRF callbacks e finaliza mint reveal

### 2.5. Engine de PvP (resolução automática)

```
function resolveMatch(clubA, clubB, boosters):
  rounds = [GOL, ZAG, MEI, ATA1, ATA2]
  score = [0, 0]
  for i in 0..4:
    a = effectiveOverwall(clubA.players[i], boostersA[i])
    b = effectiveOverwall(clubB.players[i], boostersB[i])
    if a > b: score[0]++
    elif b > a: score[1]++
    consumeStamina(clubA.players[i])
    consumeStamina(clubB.players[i])
  winner = score[0] > score[1] ? A : B
  return { rounds, score, winner }
```

**Boosters (modificadores):**

| ID | Efeito |
|---|---|
| `REDUTOR_DEFENSIVO` | adversário −50% |
| `PRESSAO_TOTAL` | próprio +30% |
| `PAREDE_ABSOLUTA` | anula booster ofensivo do adversário |
| `ESPELHO` | reflete booster do adversário |
| `CARTAO_VERMELHO` | adv −70%, próprio −20% |
| `VIRADA_HISTORICA` | se perdendo a série, próprio +40% |
| `TORCIDA_ORGANIZADA` | restantes do adversário −15% |
| `SUBSTITUICAO_ULTIMA_HORA` | troca jogador não usado |
| `JOGADOR_LENDARIO` | próprio +50% |

Regra: 1 booster por partida por jogador.

---

## 3. Frontend (React + Vite + Tailwind)

### 3.1. Estrutura de Rotas

```
/              → landing
/connect       → conexão wallet
/club          → dashboard do clube (Estádio)
/club/inventory → escalação + upgrade de elenco
/club/ct       → Centro de Treinamento (recuperar stamina)
/club/treasurer → staking MGT
/club/trophies → sala de troféus
/scout         → mintagem (10 USDC) + reveal cinematográfico
/marketplace   → listing + busca + compra
/pvp           → matchmaking + partida ao vivo
/pass          → progresso + recompensas
/minigames     → catálogo de minigames diários
/referrals     → código + estatísticas
```

### 3.2. Componentes Pixel-Art

- Pacote `react-nes-css` ou estilização custom Tailwind com fontes "Press Start 2P" e "VT323".
- Sprites dos jogadores: SVG/PNG 64x64 hospedados em IPFS.
- Animações: Framer Motion para reveal de mint.
- Paleta: 16 cores fixas inspiradas em SNES.

### 3.3. Integração Web3

- `wagmi` v2 + `viem` para conexão e leitura de contratos
- `ethers.js v6` para escrita
- Hooks customizados: `useClub`, `useInventory`, `useMintScout`, `useFuse`, `useMarketplace`

---

## 4. Tokenomics — Cálculos para Implementar

### 4.1. Distribuição inicial MGT

```
TOTAL_SUPPLY = 1_000_000_000

Rewards & Ecosystem:   500_000_000  (emissão linear 60 meses)
Tesouraria:            150_000_000  (multisig)
Equipe:                150_000_000  (cliff 12m + linear 36m)
Advisors:               50_000_000  (cliff 6m + linear 24m)
Liquidez:               80_000_000  (TGE)
Reserva/Airdrops:       70_000_000
```

### 4.2. Emissão de Rewards

```
EMISSAO_MENSAL = 500_000_000 / 60 = 8_333_333 MGT/mês
```

### 4.3. APR Staking

```
APR_BASE = 18% a.a.
recompensa_diaria(user) = stake_user * (0.18 / 365)
```

Total distribuído por staking nunca pode ultrapassar a emissão mensal alocada ao bucket de staking (sugerido 40% da emissão mensal = 3.333.333 MGT/mês).

---

## 5. Regras de Game Balance

### 5.1. Limites

| Item | Valor |
|---|---|
| NFTs por clube | 100 |
| Times por clube | 5 |
| Titulares por time | 11 |
| Reservas por time | 9 |
| Stamina máxima | 100 |
| Stamina por partida PvP | −20 |
| Stamina por sessão de farm (1h) | −10 |

### 5.2. Recuperação de Stamina

```
stamina += (10 + ctLvl * 2) por hora idle
+ uso de consumível: +25 instantâneo
+ minigame de recuperação: +15
```

### 5.3. Produção de Farm (MGT/hora)

```
producao_hora = somaOverwall(titulares) * fator_estadio * 0.000001
fator_estadio = 1 + (stadiumLvl - 1) * 0.05
```

Exemplo: 11 jogadores com OVERWALL total 50.000, estádio nível 5:
`50000 * 1.20 * 0.000001 = 0.06 MGT/hora`

### 5.4. F2P → NFT

```
10 Jogadores da Base → 1 Jogador da Base (raridade+1) — off-chain via `POST /api/merger/fuse` (taxa 0 USDC)
custo MGT para gerar 1 Jogador da Base: 100 MGT
```

---

## 6. Sequência de Sprints (MVP até TGE)

### Sprint 1–2 (semanas 1–4) — Fundação
- [ ] Setup repos (monorepo Turborepo: `apps/contracts`, `apps/api`, `apps/web`)
- [ ] CI/CD GitHub Actions
- [ ] Contratos `MGTToken`, `MLLPlayerNFT` em testnet
- [ ] Auth SIWE backend
- [ ] Landing page + conexão wallet

### Sprint 3–4 (semanas 5–8) — Scout & Burn
- [ ] `ScoutEngine` integrado com Chainlink VRF (Mumbai)
- [ ] Reveal cinematográfico no front
- [ ] `BurnEngine` com fusão 5→1
- [ ] Inventory page com filtros
- [ ] Indexer de eventos on-chain

### Sprint 5–6 (semanas 9–12) — Clube & Farm
- [ ] CRUD de clube
- [ ] Sistema de Estádio/CT/Tesoureiro/Sala (upgrades)
- [ ] Engine de farm idle + cron
- [ ] Sistema de Stamina

### Sprint 7–8 (semanas 13–16) — Marketplace & Staking
- [ ] Contrato `Marketplace` com fee 2%
- [ ] UI de listing + busca + compra
- [ ] `StakingVault` operacional
- [ ] Tesoureiro: UI de stake

### Sprint 9–10 (semanas 17–20) — PvP & Passe
- [ ] Engine de PvP melhor de 5
- [ ] Sistema de Boosters
- [ ] Divisões ranqueadas
- [ ] Passe de Temporada com XP + missões
- [ ] Minigames (3 jogos iniciais)

### Sprint 11 (semanas 21–22) — F2P & Indicações
- [ ] Jogadores da Base + conversão para NFT Comum
- [ ] Sistema de Indicações com tracking
- [ ] Anti-abuso (rate limit, device fingerprint)

### Sprint 12 (semanas 23–24) — Auditoria & TGE
- [ ] Auditoria externa (CertiK/Hacken)
- [ ] Bug bounty Immunefi
- [ ] Deploy mainnet
- [ ] TGE do MGT
- [ ] Mint inicial público

---

## 7. Variáveis de Ambiente

### Backend (`.env`)
```
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=
POLYGON_RPC_URL=https://polygon-rpc.com
MUMBAI_RPC_URL=https://rpc-mumbai.maticvigil.com
CHAIN_ID=137
INDEXER_FROM_BLOCK=
SENTRY_DSN=
PINATA_JWT=
VRF_COORDINATOR=
VRF_KEY_HASH=
VRF_SUBSCRIPTION_ID=

CONTRACT_MGT=0x...
CONTRACT_PLAYER_NFT=0x...
CONTRACT_SCOUT=0x...
CONTRACT_BURN=0x...
CONTRACT_MARKETPLACE=0x...
CONTRACT_STAKING=0x...
CONTRACT_REWARDS_POOL=0x...

USDC_ADDRESS=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
GAME_ROLE_KEY=  # chave do worker para chamar updateStamina etc
```

### Frontend (`.env`)
```
VITE_API_URL=
VITE_CHAIN_ID=137
VITE_RPC_URL=
VITE_WC_PROJECT_ID=
VITE_CONTRACT_PLAYER_NFT=
VITE_CONTRACT_SCOUT=
VITE_CONTRACT_MARKETPLACE=
VITE_CONTRACT_STAKING=
VITE_USDC=0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
```

---

## 8. Critérios de Aceitação MVP

- [ ] Usuário conecta Metamask na Polygon e cria clube
- [ ] Mintagem de 10 USDC retorna NFT com raridade verificável on-chain via VRF
- [ ] Distribuição de receita do mint executada corretamente nos 5 endereços
- [ ] Burn 5→1 funciona em todas as transições de raridade
- [ ] Marketplace executa compra/venda em USDC com fee de 2%
- [ ] PvP melhor de 5 resolve corretamente com boosters
- [ ] Staking distribui ~18% APR proporcional ao tempo
- [ ] F2P consegue gerar Jogador da Base e converter 5→1 Comum
- [ ] Programa de indicações credita 5% do farm
- [ ] Sistema de stamina impede uso excessivo de jogadores
- [ ] Limite de 100 NFTs por clube respeitado

---

## 9. Definições de Pronto (DoD)

Cada PR deve:
1. Passar lint + type-check + testes unitários (>80% coverage em contratos)
2. Ter testes de integração para fluxos críticos
3. Atualizar documentação relevante
4. Ser revisado por pelo menos 1 outro dev
5. Não introduzir vulnerabilidades flagged pelo Slither (contratos) ou Snyk (backend)

---

## 10. Contatos e Recursos

- Repositório: [a definir]
- Discord interno do time: [a definir]
- Linear/Jira: [a definir]
- Figma: [a definir]
- Referência funcional: `whitepaper.md` e `whitepapper.pdf`

*Spec v1.0 — Junho de 2026*
