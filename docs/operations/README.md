# Operações

Como rodar, deployar, monitorar e debugar o sistema.

| Documento | Conteúdo |
|---|---|
| [`local-dev.md`](./local-dev.md) | Setup zero-to-running: env, seed, primeiro login, troubleshooting. |
| [`docker.md`](./docker.md) | Stack docker-compose (api, worker, web, postgres, redis, mongo), portas, comandos. |
| [`deploy.md`](./deploy.md) | Deploy na VM demo, script seguro, secrets estáveis, rollback. |
| [`backup.md`](./backup.md) | Backup automático Postgres + Mongo a cada 12h, restore, cron. |
| [`observability.md`](./observability.md) | Sentry, Bull Board, logs Mongo, checkpoints do chain indexer. |
| [`redis-cluster.md`](./redis-cluster.md) | Redis standalone vs cluster — requisitos para escalar API/worker. |

## Runbooks

| Runbook | Quando usar |
|---|---|
| [`runbooks/api-down.md`](./runbooks/api-down.md) | Health check falha, 502, API não responde |
| [`runbooks/db-lag.md`](./runbooks/db-lag.md) | Postgres lento, timeouts Prisma, migrations |
| [`runbooks/redis-oom.md`](./runbooks/redis-oom.md) | Redis OOM, auth/PvP/jobs parados |
| [`runbooks/worker-stalled.md`](./runbooks/worker-stalled.md) | Email, stamina, mining, season não processam |
| [`runbooks/chain-indexer-lag.md`](./runbooks/chain-indexer-lag.md) | Depósitos on-chain não creditam |

## Variáveis de ambiente

Fonte da verdade: `.env.example` na raiz + validação Zod em `apps/api/src/config/env.ts`. O processo da API **falha o boot** se algo obrigatório faltar — isso é proposital.

Obrigatórias no boot da API:
- `JWT_SECRET` (≥ 32 chars)
- `DATABASE_URL`
- `REDIS_URL`
- `CORS_ORIGINS` (lista CSV)

Worker (`apps/worker`) exige `DATABASE_URL`, `REDIS_URL`. Mongo opcional mas recomendado (`MONGODB_URI`, `LOG_MONGO_ENABLED`).
