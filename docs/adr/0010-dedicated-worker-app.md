# 0010 — App dedicado `apps/worker` separado da API

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

BullMQ consumers (email, stamina, season, chain-indexer, referral) rodavam no mesmo processo que Fastify + Socket.IO (`apps/api/src/main.ts`). Escalar réplicas da API duplicava workers e schedulers repeatable. Shutdown da API não fechava workers de forma limpa.

## Decisão

- Novo workspace `apps/worker` com entrypoint `src/main.ts` — único host dos consumidores BullMQ.
- `apps/api` mantém apenas **producers** (`EmailService` enfileira via `app.redisQueue`).
- Schedulers repeatable (`stamina-recovery`, `season-reset`) registrados só no worker com `jobId` fixo para deduplicação.
- Docker: serviço `worker` separado do serviço `api`.
- Dev local: `npm run dev:worker` via `concurrently` no script `dev` raiz.

## Consequências

- ✅ API e workers escalam independentemente.
- ✅ Um container API não processa filas — logs mais limpos, menos CPU contention.
- ⚠️ Deploy exige subir worker junto com API (dependência operacional).
- ⚠️ Templates de email duplicados em worker (consumer) vs api (producer) — aceitável até extrair `packages/email`.
