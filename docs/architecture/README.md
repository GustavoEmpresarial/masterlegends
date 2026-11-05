# Arquitetura

Documentação sobre **como** o sistema é montado: fronteiras, camadas, padrões transversais.

| Documento | Conteúdo |
|---|---|
| [`overview.md`](./overview.md) | Visão geral do monorepo, monólito modular Fastify, stack resumida. |
| [`stack.md`](./stack.md) | Referência canônica da stack — versões, integrações, tooling. |
| [`stack-audit.md`](./stack-audit.md) | Auditoria review externa vs stack real (tabelas comparativas). |
| [`modules.md`](./modules.md) | Inventário dos módulos backend, prefixos, dependências, filas. |
| [`data-flow.md`](./data-flow.md) | Fluxos ponta-a-ponta: HTTP, auth, scout, marketplace, jobs. |
| [`frontend.md`](./frontend.md) | Estrutura `apps/web`: rotas, hooks, providers, i18n. |
| [`database.md`](./database.md) | Modelos Prisma por domínio, Redis vs Postgres vs Mongo. |
| [`contracts.md`](./contracts.md) | Smart contracts, redes, deploy, integração fase 1/2. |
| [`realtime.md`](./realtime.md) | Gateway Socket.IO: auth JWT, presence, PvP, notificações. |
| [`api-reference.md`](./api-reference.md) | Inventário completo de rotas HTTP + eventos Socket.IO. |
| [`codebase.md`](./codebase.md) | Mapa do código-fonte: arquivos-chave por app e pacote. |

## Princípios não-negociáveis

1. **Feature-based, não layer-based.** Cada módulo é um diretório com `routes/service/repository`. Mexer em uma feature é mexer em uma pasta.
2. **Camadas dentro do módulo.** `routes` só faz HTTP. `service` tem a regra. `repository` toca o banco. Controllers/services nunca importam `app.prisma`.
3. **Dependências unidirecionais entre módulos.** Se `club` precisa de `auth`, importa o *service* — nunca o repository ou as tabelas de `auth`.
4. **Contratos compartilhados ficam em `packages/shared`.** Schemas Zod e `ErrorCode` são source-of-truth para api e web simultaneamente.
5. **Server-authoritative.** Tudo monetário/sensível é calculado no servidor. Detalhes em [`../security/invariants.md`](../security/invariants.md).
