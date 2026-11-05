# 0001 — Monorepo via npm workspaces

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

O `ARCHITECTURE.md` original prometia Turborepo + pnpm. A realidade do repo é npm + `concurrently`. O CI usava `pnpm` mas o repo tem `package-lock.json`. Inconsistência atrapalha onboarding e CI.

## Decisão

Padronizar em **npm workspaces**, sem Turborepo, com `concurrently` para orquestrar tasks em dev. Adicionar `packages/*` e `apps/*` no campo `workspaces` da raiz.

## Alternativas consideradas

- **Turborepo + pnpm**: cache de build remoto, melhor performance. Custo: aprendizado, deps adicionais, divergência com o estado atual do repo. Não justifica nesta fase.
- **Nx**: mais opinativo, geradores. Curva alta para o tamanho do time.

## Consequências

- ✅ Setup zero-config: `npm install` na raiz resolve tudo.
- ✅ Workspaces resolvem `@mll/shared` por symlink automaticamente.
- ⚠️ Sem cache de build remoto — rebuilds são integrais.
- 🔁 Revisitar se o monorepo passar de ~5 apps ou se o tempo de CI virar gargalo.
