# @mll/worker

Consumers BullMQ — jobs em background.

Documentação: [`docs/architecture/modules.md`](../../docs/architecture/modules.md) (seção Filas).

---

## Quick start

```bash
# Requer Redis + Postgres
docker compose -f docker-compose.dev.yml up -d
npm run dev:worker
```

---

## Filas consumidas

| Fila | Tipo | Intervalo |
|------|------|-----------|
| `email` | on-demand | — |
| `stamina-recovery` | cron | 10 min |
| `season-reset` | cron | 24 h |
| `mining` | cron | configurável (`PlatformConfig`) |
| `chain-indexer` | on-event | — |
| `referral-rewards` | on-event | — |

Definições: [`packages/shared/src/queues.ts`](../../packages/shared/src/queues.ts).

---

## Scripts

| Script | Ação |
|--------|------|
| `npm run dev` | `tsx watch src/main.ts` |
| `npm run build` | `tsc` |
| `npm run start` | `node dist/main.js` |
| `npm test` | Vitest |

---

## Env

Usa do `.env` raiz:

- `DATABASE_URL` (obrigatório)
- `REDIS_URL` (obrigatório)
- `SMTP_*` (para fila email)
- `MONGODB_URI`, `LOG_*` (opcional, logs)

Schema Prisma: `../api/prisma/schema.prisma` (compartilhado).

Validação: `src/config/env.ts`.
