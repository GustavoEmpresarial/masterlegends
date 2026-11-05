# Fluxos de dados

Como requests e jobs atravessam o sistema. Invariantes de segurança: [`../security/invariants.md`](../security/invariants.md).

---

## 1. Request HTTP padrão

```mermaid
sequenceDiagram
  participant C as Cliente_Web
  participant P as Fastify_Plugins
  participant G as Guards
  participant R as Route_Zod
  participant S as Service
  participant Repo as Repository
  participant DB as PostgreSQL

  C->>P: HTTP request
  P->>P: helmet_cors_rateLimit
  P->>P: prismaContext_ALS
  P->>G: authGuard_se_verificado
  G->>R: request.user.id
  R->>R: Zod_parse_body
  R->>S: chamada_service
  S->>Repo: query_mutacao
  Repo->>DB: Prisma
  DB-->>C: Response_DTO_shared
```

**Camadas:**
1. **Plugins** (`apps/api/src/plugins/`) — segurança, contexto Prisma ALS, Redis, JWT
2. **Guards** — `authGuard` global em `/api/*`; `verifiedEmailGuard` em scout/marketplace
3. **Route** — valida com schema Zod de `@mll/shared`
4. **Service** — regras de negócio, `GAME_CONFIG`, transações
5. **Repository** — único ponto de acesso Prisma por módulo

Erros Zod → `{ error: { code: 'VALIDATION_ERROR' } }`. Erros de domínio usam `ErrorCode` de `@mll/shared`.

---

## 2. Autenticação (jogador)

```mermaid
sequenceDiagram
  participant W as Web_SPA
  participant A as API_auth
  participant R as Redis
  participant DB as PostgreSQL

  W->>A: GET /auth/csrf
  A-->>W: csrfToken
  W->>A: POST /auth/login
  A->>DB: verificar bcrypt
  A->>R: armazenar refresh jti
  A-->>W: accessToken_memoria + cookie_refresh

  Note over W: Reload_pagina
  W->>A: POST /auth/refresh + CSRF
  A->>R: rotacionar_familia
  A-->>W: novo accessToken

  W->>A: GET /auth/me + Bearer
  A-->>W: perfil
```

- Access token: **memória apenas** (`apps/web/src/lib/auth/storage.ts`)
- Refresh token: cookie `httpOnly`, `sameSite: lax`, rotação com detecção de reuso
- Detalhes: [ADR-0006](../adr/0006-refresh-token-rotation-redis.md), [ADR-0009](../adr/0009-csrf-cookie-routes.md)

---

## 3. Scout mint (off-chain)

```mermaid
sequenceDiagram
  participant W as Web
  participant API as ScoutService
  participant DB as PostgreSQL

  W->>API: POST /api/scout/mint
  API->>API: verifiedEmailGuard
  API->>DB: debitar USDC_MGTBalance
  API->>API: rollFromPool_ItemTemplate
  API->>DB: criar BasePlayer
  API->>API: PassService.addXp
  API-->>W: ScoutMintResponse
```

- RNG server-side a partir do pool `ItemTemplate` ativo
- Custo: `SCOUT_COST_USDC` (2 USDC) × quantidade
- Fase 1: sem transação blockchain — [ADR-0012](../adr/0012-scout-off-chain-phase-1.md)

---

## 4. Marketplace buy

```mermaid
sequenceDiagram
  participant B as Comprador
  participant API as MarketplaceService
  participant DB as PostgreSQL

  B->>API: POST /api/marketplace/buy/:id
  API->>DB: prisma.$transaction
  Note over DB: debitar comprador
  Note over DB: creditar vendedor_menos_taxa
  Note over DB: transferir BasePlayer
  Note over DB: desativar Listing
  API->>API: PassService XP buy/sell
  API-->>B: confirmação
```

- Taxa: `MARKETPLACE_FEE_BPS` (1000 = 10%)
- Operação atômica — falha parcial impossível

---

## 5. Farm idle

```mermaid
flowchart LR
  A[GET /api/club] --> B[computeFarmMetrics]
  B --> C[pendingFarmUsdc]
  D[POST /api/club/claim-farm] --> E[creditar MGTBalance]
  E --> F[atualizar lastFarmAt]
```

Fórmula: `sumTop11(overwall) × stadiumFactor × FARM_OVERWALL_FACTOR` USDC/hora.

- Máximo 24h acumulável (`FARM_MAX_OFFLINE_HOURS`)
- Implementação: [`game.ts`](../../apps/api/src/config/game.ts) — `calculateUsdcPerHour()`, `sumTop11Overwall()`

---

## 6. PvP (Socket.IO)

HTTP `POST /api/pvp/match` retorna 501. Fluxo real:

```mermaid
sequenceDiagram
  participant A as Jogador_A
  participant S as Socket_Gateway
  participant Redis as Redis
  participant B as Jogador_B

  A->>S: pvp:queue
  S->>Redis: LPUSH matchmaking
  B->>S: pvp:queue
  S->>Redis: match clubs
  S-->>A: pvp:matched
  S-->>B: pvp:matched
  A->>S: pvp:play round
  S->>S: calcular_round_server
  S-->>A: pvp:round_result
  S-->>B: pvp:round_result
  S->>S: persistir PvPMatch
```

Detalhes: [`realtime.md`](./realtime.md).

---

## 7. Job BullMQ

```mermaid
flowchart LR
  API[API_producer] -->|add_job| Redis[(Redis_BullMQ)]
  Redis --> Worker[Worker_consumer]
  Worker --> PG[(PostgreSQL)]
  Worker --> SMTP[SMTP_email]
```

| Fila | Trigger | Efeito |
|------|---------|--------|
| `email` | API (registro, reset, 2FA) | Nodemailer envia |
| `stamina-recovery` | Cron 10min | Restaura stamina (CT level) |
| `season-reset` | Cron 24h | Desativa temporada expirada |
| `mining` | Cron N min | Distribui USDC por overwall |
| `chain-indexer` | ChainService event | Sync on-chain → Postgres |
| `referral-rewards` | Depósito/MGT credit | Comissão 5% ao referrer |

Worker: [`apps/worker/src/workers/index.ts`](../../apps/worker/src/workers/index.ts).

---

## 8. Depósito on-chain (quando configurado)

```mermaid
sequenceDiagram
  participant U as Usuario
  participant Vault as USDCPlayerVault
  participant Chain as ChainService
  participant Q as chain-indexer
  participant W as Worker
  participant DB as PostgreSQL

  U->>Vault: deposit USDC
  Vault-->>Chain: event UsdcDeposited
  Chain->>Q: enqueue job
  Q->>W: processar
  W->>DB: WalletTransaction + MGTBalance
  W->>DB: referral commission se aplicável
```

Requer `CONTRACT_USDC_VAULT`, `POLYGON_RPC_URL` e wallet do usuário linkada.

---

## Princípio server-authoritative

O cliente envia **ações** (`mint`, `buy`, `upgrade`), nunca valores monetários ou recompensas. Toda elegibilidade, preço e payout é calculada no service com `GAME_CONFIG` e estado do banco.
