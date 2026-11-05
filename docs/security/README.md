# Segurança

| Documento | Conteúdo |
|---|---|
| [`invariants.md`](./invariants.md) | Regras não-negociáveis: never-trust-the-client, AuthN/AuthZ, hardening HTTP, banco, logging, frontend. |
| [`threat-model.md`](./threat-model.md) | Atores, ativos, superfícies de ataque, controles. |
| [`responsible-disclosure.md`](./responsible-disclosure.md) | Canal para reporte privado de vulnerabilidades antes do go-live. |

## Testes de segurança (API)

| Suite | Tipo | O que cobre |
|---|---|---|
| `tests/unit/common/player-api-guards.test.ts` | unitário | Encadeamento `authGuard` / `verifiedEmailGuard` / `config.public` no `onRoute` global |
| `tests/unit/common/prisma-context.test.ts` | unitário | Scopes ALS, `isPrismaAccessAllowed`, extension bloqueia sem contexto |
| `tests/unit/common/api-auth-global.test.ts` | integração (`INTEGRATION_TESTS=true`) | 401 em todas as rotas `/api/*` sem Bearer; `/health` público |
| `tests/integration/routes-smoke.test.ts` | integração | Rotas autenticadas respondem com token válido |

Rodar integração: `INTEGRATION_TESTS=true npm run test -w @mll/api`

## Como tratar este diretório

- Toda PR que toque auth, cookies, JWT, CORS, validação de input, queries Prisma ou exposição de dados **deve** referenciar e atualizar `invariants.md` se alterar uma invariante.
- Quebrar uma invariante "temporariamente" sem ADR explícito e aprovado = **bloqueia merge**.
- Pentest e auditoria externa: artefatos vão em `docs/security/audits/YYYY-MM-DD-*/` (gitignored se contiver findings sensíveis ainda não corrigidos).
