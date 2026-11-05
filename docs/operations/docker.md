# Docker — Master Legends League

## Quick Start

```bash
docker compose up -d --build
```

## Serviços

| Serviço | Container | Porta (host) | Função |
|---------|-----------|--------------|--------|
| **web** | mll-web | 15000 | Frontend React |
| **api** | mll-api | 3001 | HTTP + WebSocket (sem workers) |
| **worker** | mll-worker | — | BullMQ consumers (email, stamina, season, chain, referral) |
| **postgres** | mll-postgres | 5433 | Dados transacionais + `AuditLog` |
| **redis** | mll-redis | 6380 | Filas, auth tokens, Socket.IO adapter |
| **mongo** | mll-mongo | 27017 | Logs operacionais (TTL 90d) |

## Desenvolvimento local

Infra only (postgres + redis + mongo):

```bash
docker compose -f docker-compose.dev.yml up -d
```

App processes (hot-reload):

```bash
npm run dev          # api + worker + web + contracts
# ou separado:
npm run dev:api
npm run dev:worker
npm run dev:web
```

## Variáveis de ambiente

Ver [`.env.example`](../../.env.example). Novas vars relevantes:

```bash
MONGODB_URI=mongodb://localhost:27017/mll_logs
LOG_MONGO_ENABLED=true
LOG_MONGO_TTL_DAYS=90
```

No compose de produção, API e worker recebem `MONGODB_URI=mongodb://mongo:27017/mll_logs` automaticamente.

## Estrutura Docker

```
docker-compose.yml
├── postgres    # Dados + audit de segurança
├── redis       # Filas BullMQ + estado realtime
├── mongo       # Logs operacionais em massa
├── api         # Fastify + Socket.IO (producers only)
├── worker      # BullMQ consumers
└── web         # Frontend
```

## Comandos úteis

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f worker
docker compose logs -f mongo

# Consultar logs no Mongo
docker compose exec mongo mongosh mll_logs --eval 'db.logs.find().sort({ts:-1}).limit(5)'

# Postgres
docker compose exec postgres psql -U postgres -d mll

# Rebuild
docker compose up -d --build

# Limpar volumes
docker compose down -v
```

## Escalar

```bash
docker compose up -d --scale api=3 --scale worker=2
```

Schedulers repeatable usam `jobId` fixo — não duplicam cron ao escalar worker.

## Troubleshooting

### Worker não processa emails

- Verifique `docker compose logs worker` — deve mostrar `worker.start`.
- Redis acessível: `REDIS_URL=redis://redis:6379` dentro da rede compose.
- API enfileira via `app.redisQueue`; worker consome fila `email`.

### Mongo sem logs

- `LOG_MONGO_ENABLED=true` em api e worker.
- Aguarde flush (`LOG_MONGO_FLUSH_MS`, default 2s).
- API/worker dependem de `mongo` healthy no compose.
