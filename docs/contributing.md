# Contribuindo

Guia para contribuir com código e documentação no Master Legends League.

---

## Setup

Siga [`operations/local-dev.md`](./operations/local-dev.md) para ambiente funcional.

---

## Workflow

1. Fork / branch a partir de `main`
2. Implemente a mudança
3. Rode checks localmente (abaixo)
4. Atualize documentação se comportamento crítico mudou
5. Abra Pull Request com descrição clara

---

## Onde colocar código

### Backend (`apps/api`)

Padrão **feature folder** — [ADR-0004](./adr/0004-feature-based-layering.md):

```
modules/<feature>/
├── <feature>.routes.ts
├── <feature>.service.ts
└── <feature>.repository.ts
```

- `routes` — só HTTP + Zod
- `service` — regras de negócio
- `repository` — Prisma

**Não** importar `app.prisma` em services. **Não** importar repository de outro módulo — use o service.

Registre rotas em [`app.ts`](../apps/api/src/app.ts).

### Frontend (`apps/web`)

- Páginas: `src/app/<feature>/page.tsx`
- Componentes: `src/components/<feature>/`
- Hooks de dados: `src/hooks/`
- Schemas compartilhados: **não duplicar** — usar `@mll/shared`

### Contratos compartilhados

Schemas Zod, DTOs, `ErrorCode`, filas: [`packages/shared`](../packages/shared/).

Mudou API? Atualize schema em `packages/shared` **no mesmo PR**.

### Worker

Jobs novos: adicionar nome em `packages/shared/src/queues.ts` + consumer em `apps/worker/src/workers/`.

---

## Checks obrigatórios

```bash
npm run lint
npm run type-check
npm run test:ci
npm run test:contracts   # se mexeu em contracts
npm run e2e              # se mexeu em fluxo register/club/scout
```

CI replica isso em [`.github/workflows/test.yml`](../.github/workflows/test.yml).

---

## Git hooks

Husky roda `lint-staged` no pre-commit:
- `*.{ts,tsx}` → ESLint fix + Prettier
- `*.json` → Prettier

---

## Documentação

| Mudou | Atualize |
|-------|----------|
| Arquitetura / módulo novo | `docs/architecture/modules.md` |
| Fluxo de dados | `docs/architecture/data-flow.md` |
| Rota web nova | `docs/architecture/frontend.md` |
| Decisão de design | Novo ADR em `docs/adr/` (template `0000-template.md`) |
| Comportamento de segurança | `docs/security/invariants.md` |
| Gameplay / economia | `docs/product/game-design.md` ou `tokenomics.md` |
| Env var nova | `.env.example` + `apps/api/src/config/env.ts` |

**Regra:** docs que mentem são piores que docs ausentes. Atualize no mesmo PR.

---

## Convenções de código

- TypeScript strict — sem `any` desnecessário
- Identifiers em **inglês**; docs narrativos em **português**
- Commits: mensagem clara do *porquê* (Conventional Commits bem-vindo)
- Não commitar `.env`, chaves, ou `node_modules`

---

## Testes

Ver [`testing.md`](./testing.md).

Adicione testes quando cobrem comportamento real (não triviais). Coverage mínimo 80% no Vitest.

---

## ADRs

Decisões arquiteturais significativas → novo ADR numerado sequencialmente em `docs/adr/`. **Nunca renumerar** ADRs existentes.

---

## Dúvidas

- Arquitetura: [`docs/architecture/overview.md`](./architecture/overview.md)
- Segurança: [`docs/security/invariants.md`](./security/invariants.md)
- Produto: [`docs/product/dev-spec.md`](./product/dev-spec.md)
