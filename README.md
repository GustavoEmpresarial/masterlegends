# Master Legends League

**O ecossistema retrô-competitivo do futebol em NFT**

![Pixel Art](https://img.shields.io/badge/style-pixel--art-blue)
![Polygon](https://img.shields.io/badge/network-polygon-8247e5)
![License](https://img.shields.io/badge/license-MIT-green)

---

## Quick Start

### Com Docker (recomendado)

```bash
git clone https://github.com/seu-usuario/master-legends-league.git
cd master-legends-league

# Defina JWT_SECRET no .env (mín. 32 caracteres)
cp .env.example .env

./start.sh
```

**Acesse:** http://localhost:15000

### Manual (desenvolvimento)

```bash
npm install

# Infra local (Postgres 5432, Redis 6379, Mongo 27017)
docker compose -f docker-compose.dev.yml up -d

npm run db:generate
npm run db:migrate

npm run dev
```

**Dev:** web em http://localhost:5173, API em http://localhost:3001

---

## Serviços

### Stack Docker (`docker-compose.yml`)

| Serviço | Porta host | URL |
|---------|------------|-----|
| Frontend (nginx) | 15000 | http://localhost:15000 |
| API | 3001 | http://localhost:3001 |
| Worker | — | processo interno |
| PostgreSQL | 5433 | localhost:5433 |
| Redis | 6380 | localhost:6380 |
| MongoDB | 27017 | localhost:27017 |

### Dev local (`docker-compose.dev.yml`)

| Serviço | Porta |
|---------|-------|
| PostgreSQL | 5432 |
| Redis | 6379 |
| MongoDB | 27017 |

---

## Comandos úteis

```bash
./start.sh              # Docker stack completa
./stop.sh               # Parar stack
./logs.sh api           # Logs da API

npm run dev             # api + worker + web + contracts
npm run type-check      # TypeScript em todos os pacotes
npm run test:ci         # Vitest + coverage
npm run test:contracts  # Hardhat
npm run e2e             # Playwright smoke

npm run db:migrate      # Prisma migrate deploy
npm run db:seed         # Seed demo
npm run sync:contracts:env hardhat  # CONTRACT_* do manifest
```

---

## Painel Admin

Operadores usam fluxo **separado** do jogador (ADR-0013):

1. Configure `ADMIN_USERS` no `.env` (JSON com `login`, `password`, `email`, `role`)
2. Acesse http://localhost:5173/admin/login (ou :15000 no Docker)
3. Login + senha → código 2FA no email → dashboard

**Roles:** `super` (tudo), `ops` (audit + Bull Board), `support` (lista usuários).

**Aviso:** `ADMIN_ALLOW_PLAINTEXT_PASSWORDS=true` é só para dev local. Em produção use hashes bcrypt.

Não existe registro admin — contas só via variáveis de ambiente.

---

## Stack técnica

### Monorepo (npm workspaces)

| Pacote | Papel |
|--------|-------|
| `apps/api` | Fastify 5 + Prisma + Socket.IO + BullMQ producer |
| `apps/worker` | BullMQ consumers (email, crons, chain-indexer) |
| `apps/web` | React 19 + Vite + TanStack Query |
| `apps/contracts` | Solidity 0.8.26 + Hardhat |
| `packages/shared` | Zod, filas, eventos chain, DTOs |
| `packages/logging` | Pino + Mongo sink |

### Backend

- Fastify 5, Prisma 5, PostgreSQL 15, Redis 7, BullMQ, Socket.IO
- Auth email-first (JWT + refresh rotation + CSRF)
- Scout off-chain na fase 1 (ADR-0012)

### Frontend

- React 19, Vite, Tailwind, Framer Motion, i18next
- Web3 desligado na fase 1 (ADR-0005)

### Contratos

- Polygon / Amoy via Hardhat + viem
- Deploy core: `npm run deploy:local -w @mll/contracts`

---

## Estrutura

```
master-legends-league/
├── apps/
│   ├── api/           # Backend HTTP + Socket.IO
│   ├── worker/        # BullMQ workers
│   ├── web/           # SPA React
│   └── contracts/     # Solidity
├── packages/
│   ├── shared/        # Contratos compartilhados
│   └── logging/       # Logs operacionais
├── e2e/               # Playwright smoke
├── docs/              # ADRs, arquitetura, segurança
└── docker-compose.yml
```

---

## Documentação

Hub completo: [`docs/README.md`](./docs/README.md)

| Área | Links principais |
|------|------------------|
| Arquitetura | [Overview](./docs/architecture/overview.md) · [Stack](./docs/architecture/stack.md) · [API](./docs/architecture/api-reference.md) · [Código](./docs/architecture/codebase.md) |
| Produto | [Game design](./docs/product/game-design.md) · [Tokenomics](./docs/product/tokenomics.md) · [Dev spec](./docs/product/dev-spec.md) |
| Operações | [Setup local](./docs/operations/local-dev.md) · [Docker](./docs/operations/docker.md) · [Deploy](./docs/operations/deploy.md) |
| Segurança | [Invariantes](./docs/security/invariants.md) · [Threat model](./docs/security/threat-model.md) |
| Contribuir | [Contributing](./docs/contributing.md) · [Testes](./docs/testing.md) · [ADRs](./docs/adr/README.md) |

---

**Na League, toda lenda começa pequena. Mas apenas os maiores clubes conseguem alcançar a eternidade.**
