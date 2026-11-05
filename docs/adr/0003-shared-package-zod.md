# 0003 — `packages/shared` com Zod como contrato api↔web

- **Status**: accepted
- **Data**: 2026-06-04
- **Decisor(es)**: equipe core

## Contexto

Antes desta decisão, não havia código compartilhado entre `apps/api` e `apps/web`. Validações eram duplicadas (cliente validava com HTML5, servidor com Zod, schemas divergiam). `ErrorCode` estava duplicado em dois lugares. Mudar um campo exigia tocar quatro arquivos.

## Decisão

Criar **`packages/shared`** (`@mll/shared`) com schemas Zod e `ErrorCode` como **source-of-truth única**. API valida com `schema.parse()`, web valida o mesmo input antes de enviar e usa os tipos inferidos por `z.infer<typeof ...>`.

## Alternativas consideradas

- **tRPC end-to-end**: tipos automáticos, sem schemas explícitos. Acopla fortemente cliente e servidor; quebra clientes não-TS (ex.: app mobile nativo no futuro).
- **OpenAPI + codegen**: bom se houver clientes em várias linguagens. Pesado para o tamanho atual e cria uma etapa de build adicional.

## Consequências

- ✅ Uma definição de schema, dois usos.
- ✅ Tipos do request/response derivam direto do schema.
- ✅ Próximas regras de validação ficam em um único lugar.
- ⚠️ `packages/shared` precisa estar compilado antes de api/web (resolvido com `npm run build:shared` + `predev`).
- 🔁 Se um dia adotarmos tRPC, este pacote vira o ponto natural de migração.
