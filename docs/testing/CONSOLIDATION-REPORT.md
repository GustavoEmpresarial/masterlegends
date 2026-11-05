# Relatório de consolidação — Estratégia de testes (encerramento)

**Data:** 2026-07-23  
**Fase:** Auditoria final / encerramento da estratégia  
**Status:** **Estratégia de testes ENCERRADA**

---

## 1. Resumo executivo

A estratégia de testes do monorepo MLL está **completa e pronta para evolução incremental**. Infraestrutura (Vitest workspace, Playwright, Hardhat, coverage, factories, integration, e2e, security, smoke, regression, flaky, mutation, CI, k6 opcional) permanece; esta fase fechou lacunas de qualidade — em especial **mutation score 70.5% → 97.84%** nos módulos críticos — com testes de comportamento, sem alterar regras de negócio nem mascarar métricas.

Pendências remanescentes são **incrementais** (ampliar gates da API/UI) ou **dependentes de infraestrutura futura** (k6 + API live no CI, Codecov/nightly). Nenhuma pendência técnica crítica da estratégia permanece aberta sem documentação.

---

## 2. Arquivos modificados (esta entrega de encerramento)

| Arquivo | Mudança |
|---------|---------|
| `apps/api/tests/unit/events/quest-claim.service.test.ts` | Ramos: user/quest missing, janelas, campaign, caps, P2002 vs non-P2002, meta slice, progress null |
| `apps/api/tests/unit/events/period.test.ts` | Limites inclusivos, ISO week Sunday/`\|\|7`, datas que matam mutantes aritméticos |
| `apps/web/tests/security/safeMarkdown.test.ts` | trim, http:, malformed URL, image segura |
| `stryker.config.mjs` | bin local vitest; `thresholds.break: 80` |
| `.github/workflows/test.yml` | step perf-smoke opcional; artifact mutation explícito |
| `docs/testing/STRATEGY.md` | onboarding completo (coverage/mutation/flaky/e2e/k6/relatórios) |
| `docs/testing/CONSOLIDATION-REPORT.md` | este relatório de encerramento |

---

## 3. Melhorias implementadas

1. **Mutation:** testes que matam survivors reais (caps, campaign ativa, P2002 `&&`, optional chaining em meta vazia, boundaries de janela, ISO week Sunday).
2. **CI:** mutation obrigatório com break 80%; flaky já falhava o job; coverage já falhava nos thresholds Vitest; perf-smoke wrapper no job `test` (skip honesto sem k6).
3. **Determinismo:** suíte de mutation usa fake timers + mocks Prisma; smoke serial; integração sem paralelismo de arquivos.
4. **Docs:** STRATEGY como runbook para novo desenvolvedor; survivors equivalentes documentados abaixo.
5. **Sem overengineering:** sem novas deps; k6 continua opcional.

---

## 4. Mutation Score — antes / depois

| Métrica | Antes (consolidação P0/P1) | Depois (encerramento) |
|---------|----------------------------|------------------------|
| Score | **70.5%** | **97.84%** |
| Killed | 98 | 136 |
| Survived | 41 | **3** (equivalentes) |
| Runtime | ~3m | ~2.5–3m |
| Break threshold | null | **80** |

Por arquivo (após):

| Arquivo | Score |
|---------|-------|
| `period.ts` | ~100% (0 survivors) |
| `quest-claim.service.ts` | ~98.7% (1 survivor equivalente) |
| `safeMarkdown.ts` | ~93.1% (2 survivors equivalentes) |

### Survivors inevitáveis (equivalentes) — justificativa técnica

1. **`quest-claim.service.ts:113`** — `if (err instanceof AppError) throw err` → `if (false)`.  
   `AppError` não é `PrismaClientKnownRequestError`; cai no `throw err` final com a mesma instância. Comportamento observável idêntico.

2. **`safeMarkdown.ts:14`** — `if (!href) return null` → `if (false)`.  
   `href === ''` segue para `new URL('')` (throw) → `catch` retorna `null`. Resultado observável idêntico.

3. **`safeMarkdown.ts:19`** — corpo do `catch` esvaziado.  
   Após o catch vazio, o fluxo atinge `return null` na linha seguinte. Resultado observável idêntico.

Não se alterou código de produção só para “matar” mutantes equivalentes.

---

## 5. Cobertura — antes / depois

| Package | Antes | Depois (gates mantidos) |
|---------|-------|-------------------------|
| `@mll/shared` (crítico) | 100% / gate 90/85 | **inalterado** (já no alvo) |
| `@mll/web` (allowlist) | gates 85/80/75 | **inalterado** |
| `@mll/api` | gates 80/75 | **inalterado** — expansão 90/85 é melhoria incremental futura |

Não houve aumento artificial via exclusões indevidas.

---

## 6. Tempo da suíte (validação local desta fase)

| Camada | Tempo aproximado |
|--------|------------------|
| Smoke (unit crítico) | ~5s / ~48 tests |
| Mutation (3 arquivos) | ~2.5–3 min |
| Flaky ×3 | ~3 × smoke |
| Unit mutation-target | &lt; 3s |
| Regression/`test:ci` | depende de DB/services (CI) |
| E2E Playwright | job dedicado CI |
| k6 | SKIP sem binário (~instantâneo) |

Gargalo principal já mitigado: API tests com `--no-file-parallelism` / singleFork (Postgres compartilhado).

---

## 7. Otimizações realizadas

- Stryker command usa `./node_modules/.bin/vitest` (evita interferência de wrappers/`npx`).
- Mutation suite estreita + mutators `StringLiteral`/`ObjectLiteral` excluídos (custo/benefício).
- CI: fail-fast smoke; artifacts de coverage + reports; mutation só main/manual (tempo).

---

## 8. Limitações remanescentes

| Item | Tipo | Notas |
|------|------|-------|
| API/web gates &lt; 90/85 pleno | Incremental | Superfície grande; subir por fatia com testes reais |
| k6 + API live no CI | Infra futura | Wrapper + skip documentado; instalar k6 + target estável depois |
| Mutation só em 3 módulos | Escopo consciente | Expandir nightly se necessário |
| E2E cobertura fina | Incremental | scout/shop/claim flows |
| npm audit high+ informativo | Processo | `continue-on-error` — não é gate de produto |

---

## 9. Justificativa para itens não implementados

| Item pedido | Decisão | Por quê |
|-------------|---------|---------|
| k6 obrigatório com load real no CI | **Não forçado** | Sem serviço API estável no job `test`; forçar geraria flake/ruído. Wrapper + docs + skip report entregues. |
| Mutation score 100% | **Não** | 3 survivors equivalentes; matá-los exigiria mudança cosmética de produção sem valor. |
| Coverage 90% monorepo inteiro | **Não** | Mascararia qualidade; gates honestos por fatia já aplicados. |
| Novas features de produto para testar | **Fora de escopo** | Princípio da fase. |

---

## 10. Declaração de encerramento

**A estratégia de testes pode ser considerada ENCERRADA.**

Critérios atendidos:

- [x] Sem pendências técnicas relevantes da estratégia sem documentação  
- [x] Mutation maximizado (**97.84% ≥ 80%**) com survivors equivalentes justificados  
- [x] Suíte estável/determinística no caminho crítico (smoke/flaky/mutation)  
- [x] Documentação atualizada para onboarding  
- [x] Pipelines com falha em coverage / mutation&lt;80 / flaky  
- [x] Relatórios gerados (coverage, flaky, mutation, perf skip, observability)  
- [x] Sem melhorias críticas de baixo custo restantes  

Evolução futura = backlog incremental/infra, não bloqueio da estratégia.

---

## Validação (encerramento)

| Comando | Resultado |
|---------|-----------|
| `npm run test:smoke` | **PASS** — 69 tests / ~4.6s |
| `FLAKY_RUNS=3 npm run test:flaky` | **PASS** — 0 failures (~3.5–5.5s/run) |
| `npm run test:mutation` / Stryker | **97.84%** (136 killed / 3 survived equivalentes) |
| `npm run test:perf:smoke` | **SKIPPED** (k6 ausente) — report escrito |
| Lint (arquivos de teste alterados) | PASS |
| `npm run type-check` | Falhas **pré-existentes** em `apps/web` (admin/marketplace/web3) — fora do escopo da estratégia de testes; não introduzidas nesta fase |
