# Observabilidade

## Sentry (API)

Opt-in via `SENTRY_DSN` em [`apps/api/src/plugins/sentry.ts`](../../apps/api/src/plugins/sentry.ts).

- Captura erros 5xx automaticamente
- Sample rate de traces: 10% em produção
- Não habilitar sem DSN válido

## Bull Board (filas BullMQ)

Dashboard opcional em `/admin/queues` quando `ENABLE_BULL_BOARD=true`.

- **Nunca** habilitar em produção (`bullBoard.ts` bloqueia se `NODE_ENV=production`)
- Requer sessão admin JWT (`super` ou `ops`) via cookie `admin_access` ou header `Authorization`
- Filas monitoradas: `email`, `chain-indexer`, `referral-rewards`, `stamina-recovery`, `season-reset`

## Logs operacionais (MongoDB)

Pacote `@mll/logging` — ADR-0011.

| Variável | Default | Uso |
|----------|---------|-----|
| `LOG_MONGO_ENABLED` | `true` | Liga sink Mongo |
| `MONGODB_URI` | `mongodb://localhost:27017/mll_logs` | URI do cluster |
| `LOG_MONGO_TTL_DAYS` | `90` | Retenção |
| `LOG_LEVEL` | `info` | Nível Pino |

Consultas úteis no Mongo:

```javascript
db.logs.find({ 'event': 'email.sent' }).sort({ ts: -1 }).limit(20)
db.logs.find({ level: 'error' }).sort({ ts: -1 }).limit(50)
```

## Chain indexer checkpoint

Redis keys (API `JobQueues`):

- `chain:indexer:last-block` — último bloco visto pelo listener
- `chain:indexer:last-event` — último evento enfileirado

## Health endpoints

| Serviço | Endpoint |
|---------|----------|
| API | `GET /health` |
| Web (nginx) | `GET /` |
| Postgres/Redis/Mongo | healthchecks no `docker-compose.yml` |

## O que ainda não existe

- OpenTelemetry / Prometheus
- Sentry no frontend
- CD pipeline com métricas de deploy
