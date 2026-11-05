# Runbook: Worker parado

Sintoma: emails não enviados, stamina não recupera, mining não distribui, temporada não expira.

---

## 1. Verificar processo

Docker:

```bash
docker compose ps worker
docker compose logs worker --tail 100
```

Dev local: terminal do `npm run dev:worker` deve mostrar `All workers initialized`.

---

## 2. Causas comuns

| Causa | Sinal | Ação |
|-------|-------|------|
| Redis down | `ECONNREFUSED` | [`redis-oom.md`](./redis-oom.md) |
| Postgres down | Prisma errors | [`db-lag.md`](./db-lag.md) |
| Env inválido | Exit no boot | Corrigir `DATABASE_URL`, `REDIS_URL` |
| Job failed em loop | Erro repetido nos logs | Ver job específico abaixo |

---

## 3. Filas e crons

| Fila | Intervalo | O que faz |
|------|-----------|-----------|
| `email` | on-demand | SMTP via Nodemailer |
| `stamina-recovery` | 10 min | Restaura stamina |
| `season-reset` | 24 h | Desativa temporada |
| `mining` | N min (`PlatformConfig`) | Distribui USDC |
| `chain-indexer` | on-event | Sync blockchain |
| `referral-rewards` | on-event | Comissão referral |

---

## 4. Bull Board (dev/staging)

```bash
# .env
ENABLE_BULL_BOARD=true
BULL_BOARD_USER=admin
BULL_BOARD_PASSWORD=secret
```

Acesse dashboard de filas (rota registrada no plugin `bullBoard`). Ver jobs failed, retry manual.

**Bloqueado em produção** por design.

---

## 5. Reprocessar jobs

Jobs `chain-indexer` failed: ver [`chain-indexer-lag.md`](./chain-indexer-lag.md).

Para email failed: verificar SMTP e retry via Bull Board ou re-enfileirar ação do usuário (ex.: reenviar reset senha).

---

## 6. Restart

```bash
docker compose restart worker
```

Após restart, crons são re-registrados automaticamente em `setupWorkers()`.
