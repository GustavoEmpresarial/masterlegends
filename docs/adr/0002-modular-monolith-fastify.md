# 0002 — Monólito modular em Fastify (não NestJS)

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

O documento original previa NestJS, mas o código real é Fastify puro. Tínhamos rotas inline em `main.ts` misturadas a módulos parcialmente estruturados, sem fronteiras claras de camada.

## Decisão

Manter **Fastify** e adotar **monólito modular**: cada feature em `apps/api/src/modules/<feature>/` com as camadas `routes → controller (zod parse) → service → repository`. `main.ts` faz apenas bootstrap + `listen`; `app.ts` constrói o `FastifyInstance`. Plugins de infra ficam em `apps/api/src/plugins/`.

## Alternativas consideradas

- **Migrar para NestJS**: ganha DI e decorators, mas reescrita grande, dependências pesadas e curva de aprendizado para devs que não vieram de Angular. Inviável agora.
- **Hexagonal/DDD puro**: rígido demais para o tamanho atual; gera ceremony sem ganho proporcional.

## Consequências

- ✅ Cada feature é um diretório autocontido — facilita ownership e revisão.
- ✅ Cada módulo pode ser registrado independentemente (`app.register(..., { prefix })`).
- ✅ Service é trivialmente testável sem Fastify (ver `tests/modules/auth/auth.service.test.ts`).
- ⚠️ Sem DI container — wiring manual no `routes.ts` (aceitável no tamanho atual).
- 🔁 Revisitar se features começarem a precisar de injeção de dependência complexa ou se decidirmos extrair microserviços.
