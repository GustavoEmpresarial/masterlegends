# 0004 — Camadas dentro do módulo, não pastas globais

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

A organização clássica MVC (`src/controllers/`, `src/services/`, `src/models/`) força "mexer em uma feature" a tocar 3–4 diretórios. Em monólito modular com várias features (`auth`, `club`, `marketplace`, `pvp`, `pass`, `referrals`, …), isso vira atrito constante e quebra encapsulamento — fica fácil um service de `club` importar o repository de `marketplace`.

## Decisão

Organização **feature-based**. Cada feature tem seu próprio módulo em `apps/api/src/modules/<feature>/` com:

- `<feature>.routes.ts` — só I/O HTTP, validação Zod, `preHandler`.
- `<feature>.controller.ts` *(opcional, quando a transformação é não-trivial)*.
- `<feature>.service.ts` — regra de negócio autoritativa.
- `<feature>.repository.ts` — único ponto de acesso ao Prisma.

Testes espelham essa estrutura em `apps/api/tests/modules/<feature>/`.

## Alternativas consideradas

- **Layer-based clássico** (`controllers/`, `services/`, `models/`): familiar, mas favorece acoplamento entre features e dilui ownership.
- **Hexagonal puro** (`domain/`, `application/`, `infrastructure/` por feature): rigoroso demais para o tamanho atual.

## Consequências

- ✅ Uma feature = uma pasta. Adicionar feature nova é criar diretório, sem tocar nas outras.
- ✅ Regra de import clara: módulo só importa **services** de outros módulos, nunca seus repositories.
- ✅ Code review e ownership por pasta ficam triviais (`CODEOWNERS` mapeia bem).
- ⚠️ Devs vindos de Rails/Django precisam reaprender onde procurar coisas — mitigado pelo mapa em `docs/architecture/overview.md`.
