# Estratégia de testes (MLL)

Pirâmide e convenções do monorepo. Layout permanece **por workspace** — não há `tests/` na raiz.

**Status da estratégia:** encerrada (auditoria final em [`CONSOLIDATION-REPORT.md`](./CONSOLIDATION-REPORT.md)).

## Pirâmide

| Camada | Onde | Quando roda |
|--------|------|-------------|
| Unit | `apps/*/tests/unit`, `packages/*/tests` | Sempre (`npm test` / CI) |
| Integration / API | `apps/api/tests/integration` | CI + local com `INTEGRATION_TESTS=true` |
| E2E / regression smoke | `e2e/tests` | Job `e2e` no CI |
| Security | `apps/api/tests/unit/security`, `apps/web/tests/security` + schemas shared | Smoke + unit |
| Smoke | `npm run test:smoke` (&lt; 5 min) | Fail-fast no job `test` |
| Flaky detection | `npm run test:flaky` (smoke × N) | CI após regression — **falha o job** se qualquer run falhar |
| Mutation | `npm run test:mutation` (Stryker) | `main` / `workflow_dispatch` — **falha se score &lt; 80%** |
| Performance | `perf/smoke.js` (k6) | `npm run test:perf:smoke` (skip documentado se sem k6) |
| Exploratory | [`docs/qa/exploratory-checklist.md`](../qa/exploratory-checklist.md) | Manual / release |

## Como rodar

```bash
npm test                          # Vitest (sem paralelismo de arquivos)
npm run test:ci                   # generate + build + coverage (gates)
npm run test:smoke                # crítico events/gear/security
npm run test:regression           # alias → test:ci
FLAKY_RUNS=3 npm run test:flaky   # smoke × N → reports/flaky-report.md
npm run test:mutation             # Stryker → reports/mutation/ + mutation-report.md
BASE_URL=http://127.0.0.1:3001 npm run test:perf:smoke
INTEGRATION_TESTS=true npm run test:api
npm run e2e
npm run test:report               # summary → reports/observability.md
```

## Coverage

```bash
npm run test:ci                   # gera coverage por workspace
# Relatórios: apps/*/coverage, packages/*/coverage
# Formatos: text, lcov, html, json (vitest.shared.ts)
```

Gates:

| Package | Gate | Escopo medido |
|---------|------|---------------|
| `@mll/shared` | 90/90/90/85 | include crítico (`errors`, gear schema, `mgt`/`gmt`) |
| `@mll/web` | 85/85/80/75 | allowlist progressiva |
| `@mll/api` / worker / logging | 80/80/80/75 | services (excl. routes/repos/plugins) |

**Coverage gate quebrado → CI vermelho** (thresholds Vitest).

## Mutation testing

```bash
npm run test:mutation
# HTML: reports/mutation/index.html
# JSON: reports/mutation/mutation.json
# Markdown: reports/mutation-report.md
```

- Config: `stryker.config.mjs`
- Alvos: `period.ts`, `quest-claim.service.ts`, `safeMarkdown.ts`
- Threshold: `break: 80` (CI falha abaixo disso)
- Score atual: ver [`CONSOLIDATION-REPORT.md`](./CONSOLIDATION-REPORT.md)

## Flaky detection

```bash
FLAKY_RUNS=5 npm run test:flaky   # local
# CI usa FLAKY_RUNS=3
# Relatório: reports/flaky-report.md
```

Exit code ≠ 0 se qualquer execução do smoke falhar.

## E2E / smoke / regression

```bash
npm run test:smoke                # unit crítico (<5m)
npm run test:regression           # coverage + gates
npm run e2e                       # Playwright (precisa migrate + deps)
```

## Performance (k6)

### Instalação

- macOS: `brew install k6`
- Linux: ver [grafana/k6 install](https://grafana.com/docs/k6/latest/set-up/install-k6/)
- CI futuro: `grafana/setup-k6-action`

### Execução

```bash
# API precisa estar no ar
BASE_URL=http://127.0.0.1:3001 npm run test:perf:smoke
# ou: BASE_URL=https://staging.example k6 run perf/smoke.js
```

Sem binário `k6`: o script grava `reports/perf-smoke.md` com status **SKIPPED** e exit 0 (não mascara falha quando k6 está instalado e thresholds quebram).

**Não forçado no CI com servidor live** — não há compose de API no job `test`. O step roda o wrapper (skip ou fail real).

## Factories / helpers / mocks

| Recurso | Path |
|---------|------|
| Factories | `apps/api/tests/factories/` |
| Helpers | `apps/api/tests/helpers/` (`registerVerifyAndLogin`, teardown, integration-env, test-app) |
| Setup | `apps/api/tests/setup.ts` (Turnstile off), `global-setup.ts` (migrate) |

Mocks: `vi.fn` em Prisma; não mockar Zod de allowlist URL. Preferir fake timers a `sleep` fixo.

## Como criar novos testes

1. **Unit API:** `apps/api/tests/unit/<module>/*.test.ts` — mock Prisma/`$transaction`.
2. **Integration:** `apps/api/tests/integration/*.test.ts` — `isIntegrationEnabled()`, `buildTestApp`, factories.
3. **Security:** `tests/unit/security` (API) ou `tests/security` (web).
4. **E2E:** `e2e/tests/*.spec.ts` — sem seed frágil.
5. Reutilize factories (`createTestQuest`, `createTestGearCatalog`, …).

## Pipeline CI

1. lint / typecheck / test-contracts / security-audit (audit high+ informativo)
2. test: smoke → migrate → regression+coverage → flaky → perf-smoke wrapper → artifacts
3. mutation (main/manual) — falha se score &lt; 80%
4. e2e

## Interpretar relatórios

| Relatório | Como ler |
|-----------|----------|
| `*/coverage/index.html` | % lines/branches por arquivo; gate falhou se CI vermelho |
| `reports/flaky-report.md` | Failures &gt; 0 ⇒ instabilidade no smoke |
| `reports/mutation/index.html` | Survivors = mutantes não mortos; score &lt; 80 ⇒ job mutation vermelho |
| `reports/perf-smoke.md` | SKIPPED vs PASS/FAIL + summary JSON |
| `reports/observability.md` | Sumário agregado (`test:report`) |

## Troubleshooting

| Sintoma | Causa comum | Fix |
|---------|-------------|-----|
| Integration skipped | `INTEGRATION_TESTS` off | `export INTEGRATION_TESTS=true` |
| AUTH_CAPTCHA_INVALID | Turnstile do `.env` | setup zera secret em test |
| Flaky integration | arquivos API em paralelo | `--no-file-parallelism` + singleFork |
| Coverage gate fail | include medido abaixo do gate | testes reais — não baixar gate sem justificativa |
| Mutation &lt; 80% | survivors reais | fortalecer asserts de comportamento |
| Mutation lento | muitos mutantes | manter `mutate` só em críticos |
| k6 SKIPPED | binário ausente | instalar k6 + API no ar |

## Boas práticas

- Assert `ErrorCode`, não só status.
- Sem `sleep` fixo; preferir fake timers.
- Truncate + flush Redis no `beforeEach` integration.
- Não alterar regras de negócio só para facilitar testes.
- Não excluir código do coverage só para subir percentual.
