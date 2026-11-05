# @mll/api

Backend HTTP (Fastify 5) + Socket.IO gateway + BullMQ producer.

Documentação completa: [`docs/architecture/overview.md`](../../docs/architecture/overview.md).

---

## Quick start

```bash
# Da raiz (com infra Docker dev)
docker compose -f docker-compose.dev.yml up -d
npm run dev:api
```

Porta padrão: **3001**

---

## Scripts

| Script | Ação |
|--------|------|
| `npm run dev` | `tsx watch src/main.ts` |
| `npm run build` | `tsc` → `dist/` |
| `npm run start` | `node dist/main.js` |
| `npm test` | Vitest |
| `npm run db:seed` | Seed demo |

---

## Estrutura

```
src/
├── main.ts          # Entry
├── app.ts           # buildApp() + registro de rotas
├── config/          # env.ts, game.ts
├── plugins/         # prisma, redis, jwt, csrf, ...
├── modules/         # Feature folders (auth, club, scout, ...)
├── gateway/         # Socket.IO (PvP, presence)
└── common/          # guards, lib
prisma/
├── schema.prisma    # Schema compartilhado com worker
└── migrations/
```

---

## Env mínimo

Ver [`.env.example`](../../.env.example). Obrigatório: `JWT_SECRET`, `DATABASE_URL`, `REDIS_URL`, `CORS_ORIGINS`.

Validação: `src/config/env.ts` — boot falha se inválido.
