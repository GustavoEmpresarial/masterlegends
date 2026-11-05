# 0009 — CSRF só nas rotas com cookie

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

Refresh token em cookie `httpOnly` expõe `/auth/refresh` e `/auth/logout` a CSRF clássico. `SameSite=Lax` mitiga parcialmente, mas não cobre todos os vetores. Endpoints Bearer-only não precisam de CSRF.

## Decisão

- `@fastify/csrf-protection` registrado globalmente, mas **opt-in por rota** via `config.csrf = true`.
- Rotas protegidas: `POST /auth/refresh`, `POST /auth/logout`.
- `GET /auth/csrf` devolve `{ csrfToken }` e seta cookie `_csrf` assinado.
- Cliente web (`apps/web/src/lib/api/client.ts`) busca token na inicialização e injeta `X-CSRF-Token` nas rotas com cookie. Retry automático em `403 AUTH_CSRF_INVALID`.

## Consequências

- ✅ Superfície mínima — só rotas que realmente usam cookie.
- ✅ Bearer endpoints (mint, club, etc.) sem overhead de CSRF.
- ⚠️ Frontend precisa chamar `/auth/csrf` antes do primeiro refresh.
- ⚠️ Rotas web3 futuras com cookie precisarão opt-in explícito.
