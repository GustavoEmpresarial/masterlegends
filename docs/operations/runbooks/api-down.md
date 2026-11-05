# Runbook: API down

Sintoma: health check falha, jogadores não conseguem login, 502 no nginx.

---

## 1. Verificar saúde

```bash
curl -s http://localhost:3001/health
# Esperado: { "status": "ok" }
```

Docker:

```bash
docker compose ps api
docker compose logs api --tail 100
```

---

## 2. Causas comuns

| Causa | Sinal nos logs | Ação |
|-------|----------------|------|
| Env inválido | `Invalid environment variables` no boot | Corrigir `.env`, reiniciar |
| Postgres down | `Can't reach database server` | Ver runbook [`db-lag.md`](./db-lag.md) |
| Redis down | `ECONNREFUSED` Redis | Ver runbook [`redis-oom.md`](./redis-oom.md) |
| Porta em uso | `EADDRINUSE` | Liberar porta ou mudar `PORT` |
| OOM kill | Container reinicia sem stack trace | Aumentar memória / reduzir instâncias |

---

## 3. Restart controlado

Docker:

```bash
docker compose restart api
```

Manual:

```bash
npm run start -w @mll/api   # após build
```

Aguardar health OK antes de declarar resolvido.

---

## 4. Sentry

Se `SENTRY_DSN` configurado, verificar erros recentes no dashboard Sentry filtrando `environment:production`.

---

## 5. Escalonamento

Se restart não resolve e DB/Redis estão OK:

1. Capturar logs completos: `docker compose logs api > api-crash.log`
2. Verificar deploy recente (rollback via [`../deploy.md`](../deploy.md))
3. Checar migrations pendentes: `npm run db:migrate`
