# ADR-0013: Admin auth via env + 2FA email

## Status

Aceito

## Contexto

Operadores precisam de painel separado do jogador, com múltiplos logins, níveis de acesso e 2FA. Não pode existir registro público de conta admin.

## Decisão

- Admins definidos em `ADMIN_USERS` (JSON no `.env`), **fora** do modelo `User` Prisma.
- Rotas API em `/admin/api/*`; UI em `/admin/login`, `/admin/verify-2fa`, `/admin/dashboard`.
- Fluxo: login + senha → OTP 6 dígitos por email → JWT `type: admin` + cookie `admin_refresh_token`.
- RBAC: `super`, `ops`, `support` com permissões distintas no dashboard e Bull Board.
- Senha plaintext permitida só com `ADMIN_ALLOW_PLAINTEXT_PASSWORDS=true` ou fora de produção.

## Consequências

- Impossível escalar privilégio via `/auth/register`.
- Tokens admin rejeitados em rotas de jogador e Socket.IO.
- Bull Board exige sessão admin (`super` ou `ops`).
- Rotação de credenciais exige redeploy / update de env (sem CRUD admin na UI).

## Referências

- [`apps/api/src/modules/admin/`](../../apps/api/src/modules/admin/)
- [`apps/web/src/app/admin/`](../../apps/web/src/app/admin/)
