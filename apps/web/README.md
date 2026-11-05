# @mll/web

SPA React 19 + Vite 5 — cliente do jogo e painel admin.

Documentação: [`docs/architecture/frontend.md`](../../docs/architecture/frontend.md).

---

## Quick start

```bash
npm run dev:web
```

Dev server: http://localhost:5173

API default: `VITE_API_URL=http://localhost:3001`

---

## Scripts

| Script | Ação |
|--------|------|
| `npm run dev` | Vite dev server |
| `npm run build` | Build → `dist/` |
| `npm run preview` | Preview do build |
| `npm test` | Vitest + Testing Library |

---

## Estrutura

```
src/
├── main.tsx       # Providers
├── App.tsx        # Rotas
├── app/           # Páginas
├── components/    # UI
├── hooks/         # useAuth, useApi, usePvP, ...
├── lib/           # API client, socket, web3
└── i18n/          # pt-BR, en, es
```

---

## Env (Vite)

Prefixo `VITE_*` — ver [`.env.example`](../../.env.example).

| Variável | Dev default |
|----------|-------------|
| `VITE_API_URL` | `http://localhost:3001` |
| `VITE_TURNSTILE_SITE_KEY` | opcional |
| `VITE_GA_MEASUREMENT_ID` | opcional |

Docker prod: deixar `VITE_API_URL` vazio (nginx same-origin).

---

## Build produção

```bash
npm run build -w @mll/web
```

Docker: Vite build → nginx na porta **15000**. Ver `Dockerfile` e `nginx.conf`.
