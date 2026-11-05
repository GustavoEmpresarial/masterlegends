# @mll/shared

Contratos compartilhados entre API, Web e Worker — schemas Zod, DTOs, filas, economia.

Documentação: [ADR-0003](../../docs/adr/0003-shared-package-zod.md).

---

## Uso

```typescript
import { scoutMintSchema, ErrorCode, EMAIL_QUEUE } from '@mll/shared';
```

Requer build antes do consumo:

```bash
npm run build:shared
# ou da raiz: predev/postinstall faz automaticamente
```

---

## Estrutura

```
src/
├── index.ts              # Exports públicos
├── schemas/              # Zod input (auth, club, scout, ...)
├── schemas/responses/    # DTOs de resposta API
├── economy/              # mgt.ts, scout.ts
├── queues.ts             # Nomes BullMQ
├── chain-events.ts       # Eventos on-chain
├── errors.ts             # ErrorCode enum
└── jobs/email.ts         # Payloads de email
```

**Fonte da verdade** para validação API ↔ Web. Não duplicar schemas nos apps.

---

## Scripts

| Script | Ação |
|--------|------|
| `npm run build` | `tsc` → `dist/` |
| `npm run dev` | `tsc --watch` |
| `npm test` | Vitest |

---

## Ao mudar

1. Atualize schema em `src/schemas/`
2. `npm run build:shared`
3. Ajuste API routes + web hooks no mesmo PR
4. Rode `npm run type-check` na raiz
