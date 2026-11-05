# Security Invariants — Master Legends League

Estas regras são **invariantes arquiteturais**. Qualquer PR que as quebre deve ser rejeitado.

## 1. Never trust the client

- **Identidade**: o `userId` autoritativo vem de `request.user.id`, populado por `apps/api/src/common/guards/auth.guard.ts` a partir de um JWT verificado. Bodies, queries e headers nunca podem fornecer o id do usuário operado.
- **Preços / custos / recompensas**: derivados em `apps/api/src/config/game.ts` e nos `service`s. `calculateUpgradeCost` é a única fonte do custo de upgrade. O cliente jamais envia valor monetário; envia apenas a *ação* desejada.
- **Validação**: todo body/query/params é validado com schemas Zod de `@mll/shared` (`packages/shared/src/schemas`). `ZodError` é convertido em `{ error: { code: 'VALIDATION_ERROR' } }` pelo error handler global.
- **Server-authoritative writes**: mutações financeiras (MGT) são feitas em `prisma.$transaction` com `decrement` ou `increment`, nunca substituindo valor com base no body.

## 2. AuthN/AuthZ

- JWT HS256 com `JWT_SECRET` mínimo de 32 chars (validado no boot por `apps/api/src/config/env.ts`). Sem fallback hardcoded.
- Access token tem `type: 'access'` e expiração curta (`JWT_EXPIRY`, default 15m).
- Refresh token tem `type: 'refresh'`, `jti` e `familyId`, armazenado em cookie `httpOnly`, `secure` em produção, `sameSite: 'lax'`, com `maxAge` igual a `REFRESH_TOKEN_MAX_AGE_SECONDS`.
- **Rotação com família**: cada refresh emite novo par mantendo `familyId`; o `jti` anterior é marcado `used:1` no Redis. Reuso detectado → família inteira revogada (`AUTH_REFRESH_REUSED`). Implementação em `apps/api/src/modules/auth/tokens/refresh-token.service.ts`.
- O `authGuard` exige `type === 'access'` (fail-closed). Tokens `refresh`, `admin` ou sem `type` são rejeitados.
- **Auth global em `/api/*`**: todas as rotas de jogador sob `/api/*` recebem `authGuard` automaticamente via hook `onRoute` no encapsulamento Fastify (`apps/api/src/app.ts`, `apps/api/src/common/guards/player-api.guards.ts`). Módulos **não** repetem `preHandler: authGuard`. Opt-out explícito: `config.public: true` (nenhuma rota usa hoje). Email verificado: `config.requireVerifiedEmail: true` em scout mint e marketplace search.
- **Verificação de email** obrigatória para ações sensíveis (mint, marketplace) via `verifiedEmailGuard` (`apps/api/src/common/guards/verified-email.guard.ts`). Token de uso único com hash SHA-256 no Postgres, TTL 24h.
- **Reset de senha**: token de uso único, TTL 30min. Resposta de `/auth/forgot-password` sempre 200 (sem vazar existência de email). Reset revoga todas as famílias de refresh do usuário.
- **Lockout**: 5 falhas consecutivas em login → `lockedUntil` +15min (`AUTH_ACCOUNT_LOCKED`).
- Login web3 (SIWE) está **desabilitado**. As rotas `/auth/nonce` e `/auth/verify` retornam `501 AUTH_WEB3_DISABLED` enquanto a verificação real não estiver implementada (`apps/api/src/modules/auth/auth.routes.ts`). Não reabilitar sem implementar `siwe` com nonce TTL no Redis.
- **Turnstile**: quando `TURNSTILE_SECRET_KEY` está definido, `/auth/login` e `/auth/register` exigem `turnstileToken` válido (verificação server-side em `apps/api/src/common/lib/turnstile.ts`). Registro exige `acceptTerms: true` no schema Zod. Em produção, boot falha sem `TURNSTILE_SECRET_KEY`.
- **Secrets em produção**: `COOKIE_SECRET` e `ADMIN_JWT_SECRET` (distintos de `JWT_SECRET`) são obrigatórios no boot (`apps/api/src/config/env.ts`). JWT admin assinado/verificado via namespace `adminJwt`.

## 3. Surface hardening (HTTP)

- `helmet` aplicado globalmente (`apps/api/src/plugins/security.ts`). CSP restritiva em produção. HSTS habilitado.
- `@fastify/rate-limit` global (100 req/min por IP) com store Redis. Rotas sensíveis têm limites próprios (`/auth/login`, `/auth/register`, `/auth/forgot-password`: 5/min por IP). Quando autenticado, `keyGenerator` usa `request.user.id` em vez de IP.
- **CSRF** (`@fastify/csrf-protection`): rotas que aceitam cookie de refresh (`/auth/refresh`, `/auth/logout`) exigem header `X-CSRF-Token`. Token obtido via `GET /auth/csrf`. Endpoints Bearer-only ficam isentos.
- CORS por **allowlist** lida de `CORS_ORIGINS` (`apps/api/src/plugins/cors.ts`). `credentials: true` só para origens conhecidas. Sem `'*'`.
- Cookies de refresh são `httpOnly` + `sameSite: 'lax'`. CSRF explícito nas rotas com cookie (ver acima).

## 4. Database

- Rotas `/api/*` exigem JWT via guard global no encapsulamento Fastify (`apps/api/src/app.ts`). Opt-out explícito só com `config.public`.
- **Guard Prisma (ALS)**: `app.prisma` usa Prisma Client Extension + AsyncLocalStorage (`apps/api/src/common/lib/prisma-context.ts`, `create-prisma-client.ts`). O plugin `prismaContext` define o scope no `onRequest`; guards JWT preenchem `userId` / `adminId` no `preHandler`.

| Prefixo HTTP | Scope ALS inicial | Queries permitidas |
|---|---|---|
| `/health`, `/auth/*` | `system` | Sim (register/login antes de JWT) |
| `/api/*` | `player` | Sim **somente** após `authGuard` → `userId` |
| `/admin/api/login`, `verify-2fa`, `refresh`, `logout`, `csrf` | `system` | Sim |
| Demais `/admin/api/*` | `admin` | Sim **somente** após `adminGuard` → `adminId` |
| Outros paths | `blocked` | **Negado** → `PrismaContextError` |

- Fora de request HTTP (seeds, teardown de testes): usar `runWithSystemContext()` (`apps/api/tests/helpers/teardown.ts`). Bypass em dev/test: `PRISMA_GUARD_DISABLED=true` (ver `.env.example`). O worker (`apps/worker`) mantém `PrismaClient` próprio — fora deste guard.
- Acesso a `prisma` somente via `repository` por feature. Controllers/services não importam `app.prisma` diretamente. O guard ALS é rede de segurança adicional, não substitui repositories.
- Sem `$queryRaw`/`$executeRaw`. Se necessário no futuro, **somente** via `Prisma.sql`\`\`\` template para forçar parametrização — concatenação de string com input do usuário é proibida.
- Decimals (`MGTBalance.amount`, `Listing.price`) usam `Prisma.Decimal`. Nunca comparar via `Number()` antes do `decrement`.

## 5. Logging

- `pino` com `redact` em `apps/api/src/common/lib/logger.ts`. Campos sensíveis (`password`, `authorization`, `refresh_token`, `cookie`) são `[REDACTED]`.
- 5xx loga `err`; 4xx é apenas resposta — não loga corpo do request para evitar vazamento de credenciais.

## 6. Frontend

- Access token de jogador e admin ficam **somente em memória** (`apps/web/src/lib/auth/storage.ts`, `adminStorage.ts`). Sessão persiste via refresh `httpOnly`; ao recarregar a página o cliente chama `/auth/refresh` antes de `/auth/me`.
- Cliente HTTP único: `apps/web/src/lib/api/client.ts`. Interceptors anexam Bearer, fazem refresh em 401 (uma vez por requisição) e disparam `mll:logout` em falha de refresh.
- Sem `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function(...)`. ESLint (`react/no-danger: error` em `.eslintrc.cjs`) bloqueia em CI.
- WebSocket: handshake exige JWT `type=access` via `auth.token`. Salas `user:<id>` para push 1:1. Rate limit de eventos por socket (30/s) no Redis.
- Schemas Zod de `@mll/shared` revalidam input antes de mandar para o servidor (UX), mas o servidor revalida sempre.
- **Cookies de analytics**: Google Analytics (`VITE_GA_MEASUREMENT_ID`) só é carregado após consentimento no banner (`apps/web/src/lib/cookieConsent.ts`). Cookies essenciais (sessão, CSRF, idioma) não dependem de opt-in.

## 7. Auditoria

- Eventos sensíveis gravados em `AuditLog` via `apps/api/src/common/lib/audit.ts`: login, lockout, reset de senha, verificação de email, reuso de refresh token (severity `warn`).
- Logs de email sem PII: destinatário hasheado SHA-256.

## 8. Admin (operadores)

- Contas admin **não** existem na tabela `User`. Credenciais vêm de `ADMIN_USERS` no env (ADR-0013).
- **Não há** `POST /admin/api/register` nem campo `role` no registro de jogador.
- Login admin: `/admin/api/login` → 2FA email → JWT `type: admin` (separado do access token de jogador).
- Tokens `type: admin` são rejeitados por `authGuard` e pelo middleware Socket.IO.
- Senha plaintext em env só com `ADMIN_ALLOW_PLAINTEXT_PASSWORDS=true` ou fora de `production`.

## 9. Observabilidade

- **Sentry** (API): opt-in via `SENTRY_DSN`; captura 5xx. Ver [`docs/operations/observability.md`](../operations/observability.md).
- **Bull Board**: só dev/staging com `ENABLE_BULL_BOARD=true`; bloqueado em produção. Basic auth via `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD`.
- **Logs Mongo**: `@mll/logging` — não substitui `AuditLog` no Postgres.

## 10. Fora de escopo (fases futuras)

- SIWE real (ADR-0005).
- OpenTelemetry / Prometheus.
- RBAC.
- 2FA / WebAuthn.
- Scout on-chain via `ScoutEngine` (ADR-0012 — fase 2).
