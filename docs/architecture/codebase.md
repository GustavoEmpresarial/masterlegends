# Mapa do código-fonte

Índice do repositório por pasta e arquivo-chave. Para rotas HTTP, ver [`api-reference.md`](./api-reference.md). Para módulos de negócio, ver [`modules.md`](./modules.md).

---

## Monorepo

```
master-legends-league/
├── apps/
│   ├── api/          # Fastify + Prisma + Socket.IO
│   ├── worker/       # BullMQ consumers
│   ├── web/          # React SPA
│   └── contracts/    # Solidity + Hardhat
├── packages/
│   ├── shared/       # Zod, DTOs, filas, economia
│   └── logging/      # Pino + Mongo sink
├── e2e/              # Playwright
└── docs/             # Documentação (você está aqui)
```

---

## `apps/api` — Backend

### Entry points

| Arquivo | Responsabilidade |
|---------|------------------|
| [`src/main.ts`](../../apps/api/src/main.ts) | Boot HTTP, Socket.IO, ChainService, graceful shutdown |
| [`src/app.ts`](../../apps/api/src/app.ts) | `buildApp()` — plugins + registro de rotas |

### Config

| Arquivo | Conteúdo |
|---------|----------|
| [`config/env.ts`](../../apps/api/src/config/env.ts) | Env validado com Zod — boot fail-fast |
| [`config/game.ts`](../../apps/api/src/config/game.ts) | `GAME_CONFIG`, fórmulas farm/upgrade |
| [`config/pass.ts`](../../apps/api/src/config/pass.ts) | Template default de níveis do passe |

### Plugins (`src/plugins/`)

| Arquivo | Plugin Fastify |
|---------|----------------|
| `prisma.ts` | Cliente Prisma no `app.prisma` |
| `prismaContext.ts` | ALS scope por request |
| `redis.ts` | Redis command + BullMQ connection |
| `jwt.ts` | JWT player + admin namespaces |
| `csrf.ts` | CSRF para rotas com cookie |
| `cors.ts` | Allowlist `CORS_ORIGINS` |
| `security.ts` | Helmet + CSP |
| `rateLimit.ts` | 100 req/min (Redis store) |
| `errorHandler.ts` | `AppError`, Zod, Prisma → JSON |
| `sentry.ts` | Hook Sentry (opcional) |
| `bullBoard.ts` | UI filas (dev only) |
| `uploads.ts` | Multipart + static `/uploads` |

### Guards (`src/common/guards/`)

| Arquivo | Função |
|---------|--------|
| `auth.guard.ts` | Valida Bearer JWT `type: access` |
| `admin.guard.ts` | JWT admin + permissões |
| `player-api.guards.ts` | Hook global `/api/*` |
| `verified-email.guard.ts` | Bloqueia email não verificado |

### Lib compartilhada API (`src/common/lib/`)

| Arquivo | Função |
|---------|--------|
| `logger.ts` | Pino + redact + Mongo sink |
| `errors.ts` | `AppError` |
| `audit.ts` | Escrita `AuditLog` |
| `admin-audit-hook.ts` | Audit automático em mutações admin |
| `create-prisma-client.ts` | Extension row-level guard |
| `prisma-context.ts` | AsyncLocalStorage (`player`/`admin`/`system`) |
| `queues.ts` | `JobQueues` — producer BullMQ |
| `redis-queue.ts` | Tipos conexão BullMQ |
| `turnstile.ts` | Verificação Cloudflare |
| `uploads.ts` | Persistência imagens em disco |
| `secure-image.ts` | Sharp + magic bytes |
| `multipart.ts` | Parser forms complexos |
| `stamina.ts` | Cálculo stamina / overwall efetivo |

### Gateway (`src/gateway/`)

| Arquivo | Função |
|---------|--------|
| `socket.ts` | Setup Socket.IO + Redis adapter |
| `auth.middleware.ts` | JWT no handshake |
| `rateLimit.ts` | Rate limit por evento socket |
| `presence.ts` | Online/offline Redis |
| `rooms/pvp.room.ts` | Matchmaking PvP |
| `types.ts` | `AuthedSocket` |

### Módulos (`src/modules/<feature>/`)

Padrão por feature:

```
<feature>/
├── <feature>.routes.ts      # HTTP
├── <feature>.service.ts     # Regras
└── <feature>.repository.ts  # Prisma (quando existe)
```

| Pasta | Service principal | Repository |
|-------|-------------------|------------|
| `auth/` | `AuthService`, `RefreshTokenService` | via Prisma inline |
| `club/` | `ClubService` | `ClubRepository` |
| `scout/` | `ScoutService` | — |
| `marketplace/` | `MarketplaceService` | `MarketplaceRepository` |
| `wallet/` | `WalletService` | `WalletRepository` |
| `pass/` | `PassService` | `PassRepository` |
| `mining/` | `MiningService` | — |
| `referrals/` | `ReferralsService` | — |
| `vestiario/` | `VestiarioService` | — |
| `stadium/` | admin + `StadiumPlayerService` | — |
| `stadium-shop/` | `StadiumShopService` | — |
| `support/` | `SupportService` | `SupportRepository` |
| `social/` | `SocialService` | — |
| `announcements/` | `AnnouncementService` | — |
| `stats/` | `StatsService` | — |
| `admin/` | `AdminAuthService`, panel services | vários |
| `items/` | `ItemTemplateService` | — |
| `chain/` | `ChainService` | listener ethers |
| `pvp/` | stub HTTP only | — |

### Prisma

| Path | Conteúdo |
|------|----------|
| [`prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) | Schema PostgreSQL |
| `prisma/migrations/` | Migrations versionadas |
| `prisma/seed.ts` | Dados demo |

---

## `apps/worker` — Background jobs

| Arquivo | Função |
|---------|--------|
| [`src/main.ts`](../../apps/worker/src/main.ts) | Boot workers + shutdown |
| [`src/workers/index.ts`](../../apps/worker/src/workers/index.ts) | Registro de todas as filas |
| `workers/email.worker.ts` | Entrega SMTP |
| `workers/mining.worker.ts` | Lógica bloco mining |
| `lib/mgt-ledger.ts` | `applyMgtCredit` — ledger USDC |
| `lib/prisma.ts` | Prisma singleton |
| `lib/redis.ts` | Redis BullMQ |
| `config/env.ts` | Env worker |

---

## `apps/web` — Frontend

### Entry

| Arquivo | Função |
|---------|--------|
| [`src/main.tsx`](../../apps/web/src/main.tsx) | Providers + render |
| [`src/App.tsx`](../../apps/web/src/App.tsx) | React Router — todas as rotas |

### Hooks (`src/hooks/`)

| Hook | Consome |
|------|---------|
| `useApi.ts` | REST `/api/*` via React Query |
| `useAuth.tsx` | `/auth/*` — sessão jogador |
| `useAdminAuth.tsx` | `/admin/api/*` — sessão admin |
| `useWallet.ts` | Link wallet MetaMask |
| `useUsdcVault.ts` | Depósito/saque on-chain wagmi |
| `useSocket.ts` | Socket.IO + heartbeat |
| `usePvP.ts` | Eventos PvP |
| `useNotifications.ts` | Feed realtime |
| `usePublicStats.ts` | `/stats/public` |

### Lib (`src/lib/`)

| Arquivo | Função |
|---------|--------|
| `api/client.ts` | Axios jogador + interceptors |
| `api/adminClient.ts` | Axios admin |
| `auth/storage.ts` | Access token em memória |
| `auth/refresh.ts` | Retry refresh em 401 |
| `socket/client.ts` | Singleton Socket.IO |
| `web3/config.ts` | wagmi (fase 2) |
| `apiError.ts` | Map `ErrorCode` → i18n |

### Páginas (`src/app/`)

Organização espelha features do jogo — ver [`frontend.md`](./frontend.md).

---

## `packages/shared` — Contratos

| Path | Conteúdo |
|------|----------|
| [`src/index.ts`](../../packages/shared/src/index.ts) | Re-exports públicos |
| `schemas/*.ts` | Zod input por domínio |
| `schemas/responses/*.ts` | DTOs de resposta tipados |
| `economy/mgt.ts` | `MgtTxType`, tipos ledger |
| `economy/scout.ts` | `SCOUT_COST_USDC` |
| `queues.ts` | Nomes filas BullMQ |
| `chain-events.ts` | Eventos indexer |
| `errors.ts` | `ErrorCode` enum |
| `jobs/email.ts` | Templates email |

**Regra:** API valida request com schemas; response tipada com DTOs. Web importa os mesmos tipos.

---

## `packages/logging`

| Arquivo | Função |
|---------|--------|
| `src/index.ts` | `createLogger()` factory |
| `src/mongo-sink.ts` | Batch write Mongo + TTL |

---

## `apps/contracts` — On-chain

| Contrato | Arquivo | Papel |
|----------|---------|-------|
| MLLPlayerNFT | `MLLPlayerNFT.sol` | ERC-721 jogadores |
| ScoutEngine | `ScoutEngine.sol` | Mint VRF + USDC |
| Marketplace | `Marketplace.sol` | Listagem/compra NFT |
| BurnEngine | `BurnEngine.sol` | Fusão 5→1 |
| USDCPlayerVault | `USDCPlayerVault.sol` | Custódia USDC |
| MGTToken | `MGTToken.sol` | ERC-20 MGT |
| StakingVault | `StakingVault.sol` | Staking MGT |
| RewardsPool | `RewardsPool.sol` | Distribuição recompensas |
| MockUSDC | `MockUSDC.sol` | Testes locais |

Scripts: `scripts/deploy.cjs`, `scripts/sync-deploy-env.cjs`.

---

## `e2e`

| Arquivo | Função |
|---------|--------|
| `playwright.config.ts` | Config Playwright |
| `tests/smoke.spec.ts` | register → club → scout |

---

## Onde implementar mudanças

| Quero… | Onde mexer |
|--------|------------|
| Nova rota REST | `apps/api/src/modules/<x>/<x>.routes.ts` + schema `@mll/shared` |
| Nova regra de negócio | `*.service.ts` do módulo |
| Novo campo no banco | `prisma/schema.prisma` + migration |
| Nova página web | `apps/web/src/app/<x>/page.tsx` + hook em `useApi.ts` |
| Novo job background | `packages/shared/queues.ts` + `apps/worker/src/workers/` |
| Novo contrato | `apps/contracts/contracts/` + deploy script |
| Constante de jogo | `apps/api/src/config/game.ts` ou `@mll/shared/economy` |

---

## Testes por pacote

| Pacote | Path testes |
|--------|-------------|
| API | `apps/api/tests/` |
| Worker | `apps/worker/tests/` |
| Web | `apps/web/tests/` |
| Shared | `packages/shared/` (vitest config) |
| Contracts | `apps/contracts/test/` |
| E2E | `e2e/tests/` |

Ver [`../testing.md`](../testing.md).
