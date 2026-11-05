# Testes

Estratégia de testes do monorepo Master Legends League.

---

## Visão geral

| Camada | Ferramenta | Pacotes |
|--------|------------|---------|
| Unit / integration | **Vitest** ^1.6.0 | `shared`, `logging`, `api`, `worker`, `web` |
| Smart contracts | **Hardhat** + Chai | `contracts` |
| E2E smoke | **Playwright** ^1.49.0 | `e2e` |

Workspace: [`vitest.workspace.ts`](../vitest.workspace.ts)

---

## Comandos

| Comando | Ação |
|---------|------|
| `npm test` | Vitest todos os projetos |
| `npm run test:ci` | Generate + build shared/logging + coverage |
| `npm run test:api` | Só `@mll/api` |
| `npm run test:worker` | Só `@mll/worker` |
| `npm run test:web` | Só `@mll/web` |
| `npm run test:contracts` | Hardhat tests |
| `npm run e2e` | Playwright smoke |
| `npm run e2e:install` | Instala Chromium |

---

## Coverage (Vitest)

Thresholds em `vitest.shared.ts`:

| Métrica | Mínimo |
|---------|--------|
| lines | 80% |
| functions | 80% |
| statements | 80% |
| branches | 75% |

Provider: `@vitest/coverage-v8`.

---

## API (`apps/api/tests/`)

- **Unit:** services, guards, utils
- **Integration:** rotas com Fastify `inject()`, Prisma test DB
- Redis mock: `ioredis-mock`
- Teardown: `runWithSystemContext()` para seeds

Pré-requisitos integration: Postgres + Redis (CI usa service containers).

---

## Worker (`apps/worker/tests/`)

Testa handlers de jobs com Prisma/Redis mock ou test DB.

---

## Web (`apps/web/tests/`)

- **@testing-library/react** + jsdom
- Componentes e hooks isolados
- Sem E2E aqui — Playwright cobre fluxo completo

---

## Contracts (`apps/contracts/test/`)

- `MGTToken.test.cjs`
- `USDCPlayerVault.test.cjs`
- Coverage Solidity: `npm run coverage -w @mll/contracts`

---

## E2E (`e2e/`)

Config: [`e2e/playwright.config.ts`](../e2e/playwright.config.ts)

Smoke flow ([`e2e/tests/smoke.spec.ts`](../e2e/tests/smoke.spec.ts)):
1. Register
2. Create club
3. Scout mint

**Pré-requisitos:** stack rodando (API + web + DB). CI sobe serviços antes do job e2e.

```bash
npm run e2e:install   # primeira vez
npm run dev           # em outro terminal
npm run e2e
```

---

## Ambiente de teste

| Arquivo | Uso |
|---------|------|
| `.env.test` | Config testes locais |
| `.env.test.example` | Template |

CI injeta `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET` via workflow.

---

## CI (GitHub Actions)

[`.github/workflows/test.yml`](../.github/workflows/test.yml):

1. `lint` — ESLint
2. `typecheck` — TypeScript todos pacotes
3. `test-contracts` — Hardhat
4. `test` — Vitest com Postgres/Redis/Mongo services
5. `e2e` — Playwright após build

Node **20**, `npm ci`.

---

## Boas práticas

- Teste comportamento, não implementação
- Mocks só onde integração é cara (Redis, SMTP)
- Não testar getters triviais
- Integration tests para fluxos financeiros (marketplace, scout debit)
- Atualize testes quando mudar schemas `@mll/shared`
