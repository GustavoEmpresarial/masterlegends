# 0006 — Refresh token rotation com família no Redis

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

Refresh tokens de 30 dias em cookie `httpOnly` sem rotação significam que um vazamento dá acesso prolongado. Precisávamos de rotação com detecção de reuso sem sobrecarregar o Postgres.

## Decisão

- Refresh tokens carregam `jti` (256 bits) e `familyId` no JWT.
- Estado (`used`, `userId`) fica no Redis com TTL nativo (`rt:jti:*`, `rt:family:*`).
- Cada `/auth/refresh` marca o `jti` anterior como usado e emite novo par na mesma família.
- Reuso de `jti` já consumido → revoga família inteira + `AUTH_REFRESH_REUSED` + audit log `warn`.
- `/auth/logout` e reset de senha revogam todas as famílias do usuário.

## Consequências

- ✅ Alto throughput, TTL automático, sem migration pesada para tokens.
- ✅ Detecção de roubo de sessão (ataque apresenta token stale após rotação legítima).
- ⚠️ Redis é dependência crítica para auth — perda de dados invalida sessões (aceitável).
- ⚠️ Múltiplos workers exigem Redis compartilhado (já temos).
