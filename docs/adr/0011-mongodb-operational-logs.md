# 0011 — MongoDB para logs operacionais em massa

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

Pino escrevia só em stdout. HTTP access logs, eventos WS, jobs BullMQ e erros operacionais crescem rápido — Postgres não é o lugar certo para isso. `AuditLog` no Postgres é baixo volume e precisa de FK com `User` (dados importantes de segurança).

## Decisão

- Novo pacote `packages/logging` com `createLogger({ service })` — pino com multistream (stdout + MongoDB).
- Sink Mongo assíncrono: buffer + `insertMany` em bulk (`LOG_MONGO_BATCH_SIZE`, `LOG_MONGO_FLUSH_MS`).
- Collection `logs` com TTL index (`LOG_MONGO_TTL_DAYS`, default 90).
- `AuditLog` **permanece no Postgres** — source-of-truth de compliance.
- Usado por `apps/api` (`service: 'api'`) e `apps/worker` (`service: 'worker'`).
- Infra: serviço `mongo:7` no docker-compose.

## Consequências

- ✅ Logs operacionais escalam sem inflar Postgres.
- ✅ stdout mantido para `docker compose logs` e dev.
- ⚠️ Sem UI de consulta nesta fase — usar `mongosh` ou ferramenta externa.
- ⚠️ Mongo é best-effort: falha no sink não derruba o processo (stdout continua).
