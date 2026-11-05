# Architecture Decision Records

Cada decisão arquitetural relevante vira um ADR numerado. ADRs **nunca são editados** depois de aceitos — se a decisão muda, abre-se um novo ADR que **supersede** o anterior.

## Convenção

- Numeração sequencial, 4 dígitos, sem reaproveitar: `0001-`, `0002-`, …
- Slug curto após o número: `0007-modular-monolith-fastify.md`.
- Status do ADR: `proposed` → `accepted` → (`superseded by NNNN` | `deprecated`).
- Use [`0000-template.md`](./0000-template.md) como ponto de partida.

## Índice

| Número | Título | Status |
|---|---|---|
| [0001](./0001-monorepo-npm-workspaces.md) | Monorepo via npm workspaces (não Turborepo nem pnpm) | accepted |
| [0002](./0002-modular-monolith-fastify.md) | Monólito modular em Fastify (não NestJS) | accepted |
| [0003](./0003-shared-package-zod.md) | `packages/shared` com Zod como contrato api↔web | accepted |
| [0004](./0004-feature-based-layering.md) | Camadas dentro do módulo (não pastas globais de `controllers/` e `models/`) | accepted |
| [0005](./0005-disable-web3-auth-phase-1.md) | SIWE desabilitada na Fase 1 até verificação real | accepted |
| [0006](./0006-refresh-token-rotation-redis.md) | Refresh token rotation com família no Redis | accepted |
| [0007](./0007-socketio-realtime.md) | socket.io para PvP, presence e notificações | accepted |
| [0008](./0008-smtp-nodemailer-email.md) | Email via SMTP genérico (nodemailer + BullMQ) | accepted |
| [0009](./0009-csrf-cookie-routes.md) | CSRF só nas rotas com cookie (refresh/logout) | accepted |
| [0010](./0010-dedicated-worker-app.md) | App dedicado `apps/worker` separado da API | accepted |
| [0011](./0011-mongodb-operational-logs.md) | MongoDB para logs operacionais; Postgres para audit | accepted |
| [0012](./0012-scout-off-chain-phase-1.md) | Scout off-chain na fase 1; on-chain ScoutEngine na fase 2 | accepted |
| [0013](./0013-env-based-admin-auth.md) | Admin via env + 2FA email; sem registro admin | accepted |
