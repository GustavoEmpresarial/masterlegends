# Documentação — Master Legends League

Ponto único de entrada para toda a documentação do projeto. O `README.md` da raiz contém apenas quick-start; o conhecimento de longo prazo mora aqui.

## Mapa

| Seção | Para que serve | Leia se você está… |
|---|---|---|
| [`architecture/`](./architecture/README.md) | Como o monólito modular é montado, fronteiras, padrões. | …entrando no projeto ou planejando uma feature nova. |
| [`security/`](./security/README.md) | Invariantes não-negociáveis, threat model, política. | …mexendo em auth, dados sensíveis ou exposição pública. |
| [`operations/`](./operations/README.md) | Como rodar, deployar, monitorar, troubleshoot. | …subindo o app local, configurando staging/prod. |
| [`product/`](./product/README.md) | Whitepaper, especificação de gameplay, tokenomics. | …entendendo *o que* está sendo construído e por quê. |
| [`adr/`](./adr/README.md) | Architecture Decision Records (decisões de design e por que). | …revivendo um "por que isso foi escolhido?". |

## Referência de código

| Documento | Conteúdo |
|---|---|
| [`architecture/api-reference.md`](./architecture/api-reference.md) | Todas as rotas HTTP e eventos WebSocket. |
| [`architecture/codebase.md`](./architecture/codebase.md) | Mapa de arquivos e services por pacote. |
| [`architecture/stack-audit.md`](./architecture/stack-audit.md) | Tabelas: review externa vs stack real do MLL. |
| [`packages/shared/src/schemas/`](../../packages/shared/src/schemas/) | Schemas Zod (fonte da verdade request/response). |
| [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) | Modelos de dados PostgreSQL. |

## Guias transversais

| Documento | Conteúdo |
|---|---|
| [`contributing.md`](./contributing.md) | Como contribuir — workflow, onde colocar código, checks. |
| [`testing.md`](./testing.md) | Vitest, Playwright, Hardhat, CI, coverage. |

## READMEs por app (quick-start)

| App / pacote | Link |
|---|---|
| API | [`apps/api/README.md`](../apps/api/README.md) |
| Web | [`apps/web/README.md`](../apps/web/README.md) |
| Worker | [`apps/worker/README.md`](../apps/worker/README.md) |
| Contracts | [`apps/contracts/README.md`](../apps/contracts/README.md) |
| Shared | [`packages/shared/README.md`](../packages/shared/README.md) |
| Logging | [`packages/logging/README.md`](../packages/logging/README.md) |
| E2E | [`e2e/README.md`](../e2e/README.md) |

## Convenções

- **Português** para narrativa do dia-a-dia (decisões internas, ADRs); **inglês** para identifiers/código.
- Arquivos em `kebab-case.md`. Nada em CAPS_LOCK.
- Cada subpasta tem um `README.md` que serve de índice local.
- Diagramas: prefira `mermaid` inline em markdown. Imagens só quando inevitável e sempre em `docs/_assets/`.
- ADRs seguem o template em [`adr/0000-template.md`](./adr/0000-template.md). Numeração sequencial, **nunca renumerar**.
- Mudou comportamento crítico? Atualize o doc *no mesmo PR*. Docs que mentem são piores que docs ausentes.

## Onde NÃO documentar

- **README dos apps** (`apps/api/README.md`, `apps/web/README.md`) — só quick-start daquele app específico. Conceito transversal vem aqui.
- **Comentários no código** — apenas o "por que" não-óbvio. O "o que" deve ser legível pelo próprio código.
- **Schemas e contratos da API** — fonte da verdade é `packages/shared/src/schemas/*` e `prisma/schema.prisma`. Docs referenciam, não duplicam.
