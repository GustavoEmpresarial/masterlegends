# Auditoria de stack — review externa vs MLL real

Comparação cirúrgica entre uma review recebida (tRPC, better-auth, Arbitrum, etc.) e o que o repositório **realmente** usa. Fonte canônica de versões: [`stack.md`](./stack.md).

*Atualizado: junho 2026*

---

## Veredito geral

| Item | Conclusão |
|------|-----------|
| Review descreve este repo? | **Não** — ~80% dos pontos referem-se a outra stack |
| Stack documentada | [`stack.md`](./stack.md) + `package.json` dos workspaces |
| Ação necessária | Nenhuma migração para tRPC / better-auth / Arbitrum |

---

## Tabela comparativa — review vs MLL real

| Camada | Review afirma | MLL real | Evidência | Veredito |
|--------|---------------|----------|-----------|----------|
| API HTTP | tRPC 11 + SuperJSON + Fastify 5 | REST + Fastify 5 | [`app.ts`](../../apps/api/src/app.ts) | Review errada |
| Tipagem E2E | tRPC sem codegen | Zod + DTOs + axios manual | [`@mll/shared`](../../packages/shared/), [`useApi.ts`](../../apps/web/src/hooks/useApi.ts) | Parcial — validação compartilhada, sem tipagem de rotas |
| Serialização | SuperJSON | JSON padrão | — | Não usa |
| Frontend data | React Query 5 | TanStack Query ^5.17 | [`apps/web/package.json`](../../apps/web/package.json) | Review correta |
| Routing web | TanStack Router | React Router ^6.21 | [`App.tsx`](../../apps/web/src/App.tsx) | Review errada |
| Auth | better-auth 1.2 | JWT custom + bcrypt + Redis | [ADR-0005](../adr/0005-disable-web3-auth-phase-1.md), [ADR-0006](../adr/0006-refresh-token-rotation-redis.md) | Review errada |
| Auth no worker | better-auth no worker | Sem auth no worker | [`apps/worker/package.json`](../../apps/worker/package.json) | Review errada |
| CSS | Tailwind 4.1 + `@tailwindcss/vite` | Tailwind ^3.4 + PostCSS | [`tailwind.config.js`](../../apps/web/tailwind.config.js) | Review errada |
| Blockchain | Arbitrum + OZ 5.3 + Ignition | Polygon/Amoy + OZ ^5.0.1 + `deploy.cjs` | [`hardhat.config.cjs`](../../apps/contracts/hardhat.config.cjs) | Review errada |
| Filas | BullMQ sem Redis Cluster | BullMQ + `REDIS_URL` standalone | [`plugins/redis.ts`](../../apps/api/src/plugins/redis.ts) | Parcialmente válida |
| E2E | Vitest + execa | Playwright ^1.49 | [`e2e/package.json`](../../e2e/package.json) | Review errada |
| Monorepo | npm workspaces | npm workspaces | [`package.json`](../../package.json) | Review correta |
| ORM | Prisma | Prisma ^5.9 | [`schema.prisma`](../../apps/api/prisma/schema.prisma) | Review correta |
| CI | GitHub Actions pesado | 5 jobs (lint, types, contracts, test, e2e) | [`.github/workflows/test.yml`](../../.github/workflows/test.yml) | Review correta |
| Express / rate-limit | (não citado) | Fastify only; sem Express | [`stack.md`](./stack.md) § O que NÃO usamos | Resolvido — `rate-limit-redis` removido |

---

## O que está sólido no MLL

| Área | Tecnologia / padrão | Por quê |
|------|---------------------|---------|
| Backend | Fastify 5 modular | Feature folders, guards, server-authoritative — [ADR-0002](../adr/0002-modular-monolith-fastify.md) |
| Contratos | `@mll/shared` + Zod | API ↔ web sem duplicar schemas — [ADR-0003](../adr/0003-shared-package-zod.md) |
| Frontend data | TanStack Query 5 | Server state por domínio |
| Background | Worker BullMQ separado | Crons fora da API — [ADR-0010](../adr/0010-dedicated-worker-app.md) |
| Auth | JWT + refresh rotation | CSRF, lockout, Turnstile — testado e documentado |
| E2E | Playwright | Smoke browser real (register → club → scout) |
| CI | GitHub Actions | Lint, types, contratos, integração, e2e |
| Produto fase 1 | Off-chain first | Scout e Web3 auth desligados por ADR |

---

## Pontos de atenção reais (MLL)

| Risco | Situação atual | Severidade | Mitigação |
|-------|----------------|------------|-----------|
| Tipagem API não E2E | Rotas REST + axios; sem tRPC | Média | Zod em `@mll/shared` + `type-check` + mesmo PR |
| Redis standalone | Uma `REDIS_URL` para tudo | Baixa agora / alta em escala | Ver [`../operations/redis-cluster.md`](../operations/redis-cluster.md) |
| Sync Prisma + contratos + Zod | 3 fontes de verdade | Média | CI + disciplina de PR |
| Auth custom | Mais código próprio | Média | ADRs + testes em `apps/api/tests/` |
| Web3 fase 2 | wagmi instalado, desligado | Planejada | [ADR-0005](../adr/0005-disable-web3-auth-phase-1.md) |
| Tailwind v3 | Sem v4 | Neutro | Upgrade futuro opcional |

---

## Falsos alarmes da review

| Afirmação da review | Realidade no MLL |
|---------------------|------------------|
| Usar better-auth + plano B | Não existe no projeto |
| Migrar / treinar Tailwind v4 | Usa v3.4 |
| Adotar TanStack Router | Usa React Router 6 |
| Adotar tRPC / SuperJSON | REST + Zod |
| Target Arbitrum + Ignition | Polygon/Amoy + `deploy.cjs` |
| Trocar E2E por Playwright | Já usa Playwright |
| Worker depende de better-auth | Falso |
| Express no projeto | Não — ver [`stack.md`](./stack.md) |

---

## Stack real MLL (resumo)

| Camada | Tecnologia | Versão |
|--------|------------|--------|
| Runtime | Node.js | 20 |
| Linguagem | TypeScript | ^5.3 |
| Monorepo | npm workspaces | — |
| API | Fastify | ^5.0 |
| ORM | Prisma | ^5.9 |
| DB | PostgreSQL | 15 |
| Cache / filas | Redis + BullMQ | 7 / ^5.8 |
| Logs | MongoDB + Pino | 7 |
| Realtime | Socket.IO | ^4.7 |
| Auth | JWT + bcrypt + Redis | custom |
| Validação | Zod (`@mll/shared`) | ^4.4 |
| Web | React + Vite | 19 / 5 |
| Routing | React Router | ^6.21 |
| Data fetching | TanStack Query | ^5.17 |
| HTTP client | axios | ^1.16 |
| CSS | Tailwind + PostCSS | ^3.4 |
| Contracts | Solidity + Hardhat | 0.8.26 / ^2.19 |
| Chain | Polygon + Amoy | 137 / 80002 |
| E2E | Playwright | ^1.49 |
| Unit / integration | Vitest | ^1.6 |
| CI | GitHub Actions | 5 jobs |

---

## Ações já aplicadas

| Ação | Status |
|------|--------|
| Remover `rate-limit-redis` morto | Feito — [`apps/api/package.json`](../../apps/api/package.json) |
| Seção "O que NÃO usamos" em `stack.md` | Feito |
| Doc Redis Cluster para escala | Feito — [`../operations/redis-cluster.md`](../operations/redis-cluster.md) |

---

## O que NÃO usamos (referência rápida)

| Não usamos | Usamos no lugar |
|------------|-----------------|
| Express | Fastify 5 |
| tRPC / SuperJSON | REST + axios + Zod |
| better-auth | JWT custom |
| TanStack Router | React Router 6 |
| Tailwind v4 | Tailwind 3.4 |
| Arbitrum | Polygon / Amoy |
| Hardhat Ignition | `deploy.cjs` |
| Next.js | Vite SPA |

Detalhes: [`stack.md`](./stack.md).
