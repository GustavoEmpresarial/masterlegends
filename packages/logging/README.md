# @mll/logging

Logger Pino com sink MongoDB para logs operacionais de alto volume.

Documentação: [ADR-0011](../../docs/adr/0011-mongodb-operational-logs.md).

---

## Uso

```typescript
import { createLogger } from '@mll/logging';

const logger = createLogger({
  service: 'api',
  mongoUri: process.env.MONGODB_URI,
  enabled: process.env.LOG_MONGO_ENABLED === 'true',
});
```

---

## Comportamento

- **Pino** para stdout (desenvolvimento / containers)
- **MongoDB sink** com batching (`LOG_MONGO_BATCH_SIZE`, `LOG_MONGO_FLUSH_MS`)
- TTL automático (`LOG_MONGO_TTL_DAYS`, default 90 dias)
- Mongo é **apenas logs** — não armazena domínio de jogo

---

## Env

| Variável | Default |
|----------|---------|
| `MONGODB_URI` | `mongodb://localhost:27017/mll_logs` |
| `LOG_MONGO_ENABLED` | `true` |
| `LOG_MONGO_TTL_DAYS` | `90` |
| `LOG_MONGO_BATCH_SIZE` | `100` |
| `LOG_MONGO_FLUSH_MS` | `2000` |

---

## Scripts

```bash
npm run build -w @mll/logging
npm test -w @mll/logging
```
