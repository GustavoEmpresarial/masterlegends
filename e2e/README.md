# @mll/e2e

Testes end-to-end com Playwright — smoke do fluxo principal.

Documentação: [`docs/testing.md`](../docs/testing.md).

---

## Pré-requisitos

1. Stack rodando (API + web + Postgres + Redis)
2. Chromium instalado

```bash
npm run e2e:install   # primeira vez
```

---

## Rodar

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run e2e
```

Ou só da raiz se stack já está up.

---

## Smoke test

[`tests/smoke.spec.ts`](./tests/smoke.spec.ts):

1. Registro de usuário
2. Criação de clube
3. Scout mint

Config: [`playwright.config.ts`](./playwright.config.ts) — base URL default `http://localhost:5173`.

---

## CI

Job `e2e` no GitHub Actions sobe serviços e roda após Vitest passar.
