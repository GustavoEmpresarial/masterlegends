# Setup local — zero to running

Guia para rodar o projeto completo em máquina nova.

---

## Pré-requisitos

| Ferramenta | Versão |
|------------|--------|
| Node.js | **20** |
| npm | 9+ (vem com Node) |
| Docker + Compose | Para Postgres, Redis, Mongo |
| Git | Clone do repositório |

---

## 1. Clone e dependências

```bash
git clone <repo-url>
cd master-legends-league
npm install
```

O `postinstall` roda `prisma generate` automaticamente.

---

## 2. Variáveis de ambiente

```bash
cp .env.example .env
```

### Mínimo para boot da API

| Variável | Exemplo | Obrigatório |
|----------|---------|-------------|
| `JWT_SECRET` | string ≥ 32 chars | Sim |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/mll` | Sim |
| `REDIS_URL` | `redis://localhost:6379` | Sim |
| `CORS_ORIGINS` | `http://localhost:5173` | Sim |
| `WEB_URL` | `http://localhost:5173` | Sim |

### Recomendado para dev completo

| Variável | Notas |
|----------|-------|
| `MONGODB_URI` | `mongodb://localhost:27017/mll_logs` |
| `LOG_MONGO_ENABLED` | `true` |
| `ADMIN_USERS` | JSON com operador admin (ver `.env.example`) |
| `ADMIN_ALLOW_PLAINTEXT_PASSWORDS` | `true` só em dev |
| `ADMIN_2FA_DISABLED` | `true` para pular 2FA local |
| `SMTP_HOST` | `localhost` + Mailhog na porta 1025 |

Em produção: `COOKIE_SECRET`, `ADMIN_JWT_SECRET` e `TURNSTILE_SECRET_KEY` são obrigatórios.

Validação: [`apps/api/src/config/env.ts`](../../apps/api/src/config/env.ts) — boot falha se inválido.

---

## 3. Infraestrutura (Docker)

```bash
docker compose -f docker-compose.dev.yml up -d
```

| Serviço | Porta host |
|---------|------------|
| PostgreSQL | 5432 |
| Redis | 6379 |
| MongoDB | 27017 |

Verificar: `docker compose -f docker-compose.dev.yml ps`

---

## 4. Banco de dados

```bash
npm run db:migrate
npm run db:seed    # opcional — dados demo
```

Prisma Studio (GUI): `npm run db:studio`

---

## 5. Rodar aplicação

```bash
npm run dev
```

Sobe em paralelo: API, worker, web e Hardhat node (contratos).

| Serviço | URL |
|---------|-----|
| Web (Vite) | http://localhost:5173 |
| API | http://localhost:3001 |
| Hardhat node | http://127.0.0.1:8545 |

Alternativa só API: `npm run dev:api`

---

## 6. Primeiro acesso (jogador)

1. Abra http://localhost:5173/register
2. Crie conta (Turnstile opcional se `TURNSTILE_SECRET_KEY` vazio)
3. Verifique email (se SMTP configurado) ou use seed com usuário pré-verificado
4. Crie clube em `/club`
5. Scout em `/scout`

Smoke E2E cobre: register → club → scout (`e2e/tests/smoke.spec.ts`).

---

## 7. Painel admin

1. Configure `ADMIN_USERS` no `.env` (exemplo no `.env.example`)
2. Acesse http://localhost:5173/admin/login
3. Login + senha → 2FA por email (ou `ADMIN_2FA_DISABLED=true`)
4. Roles: `super`, `ops`, `support`

Detalhes: [ADR-0013](../adr/0013-env-based-admin-auth.md).

---

## 8. Contratos locais (opcional)

```bash
# Terminal separado se não usar npm run dev
npm run dev:contracts -w @mll/contracts

# Deploy local
npm run deploy:local -w @mll/contracts

# Sincronizar endereços para .env
npm run sync:contracts:env hardhat
```

Reinicie API após sync para `ChainService` pegar os endereços.

---

## 9. Docker stack completa (alternativa)

```bash
cp .env.example .env
# Defina JWT_SECRET no .env
./start.sh
```

| Serviço | URL |
|---------|-----|
| Web (nginx) | http://localhost:15000 |
| API | http://localhost:3001 |

Ver [`docker.md`](./docker.md).

---

## Troubleshooting

### API não sobe — env inválido

```
Error: Invalid environment variables
```

Confira `JWT_SECRET` (≥32 chars), `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGINS`.

### Prisma — conexão recusada

Postgres não está rodando. `docker compose -f docker-compose.dev.yml up -d`.

### Porta 5173 ou 3001 ocupada

Mate o processo ou altere `PORT` (API) / porta Vite em `vite.config.ts`.

### Redis connection refused

Redis não está rodando ou `REDIS_URL` aponta para porta errada (6380 é Docker full stack, 6379 é dev infra).

### `prisma generate` falha

Rode da raiz: `npm run db:generate`. Verifique Node 20.

### Worker sem efeito

Worker precisa do mesmo `DATABASE_URL` e `REDIS_URL`. Logs: terminal do `dev:worker`.

### Email não chega

Dev: use Mailhog (`SMTP_PORT=1025`). Worker entrega — API só enfileira.

---

## Comandos úteis

```bash
npm run type-check      # TypeScript todos os pacotes
npm run lint            # ESLint
npm run test:ci         # Vitest + coverage
npm run test:contracts  # Hardhat
npm run e2e             # Playwright smoke
./logs.sh api           # Logs Docker (stack completa)
```
