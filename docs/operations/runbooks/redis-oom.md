# Runbook: Redis OOM / indisponível

Sintoma: auth refresh falha, rate limit quebrado, PvP matchmaking parado, jobs BullMQ não processam.

---

## 1. Verificar Redis

```bash
redis-cli -u "$REDIS_URL" PING
# Esperado: PONG
```

Docker:

```bash
docker compose ps redis
docker compose logs redis --tail 50
```

---

## 2. Memória cheia (OOM)

Sintoma: `OOM command not allowed`, Redis rejeita writes.

```bash
redis-cli -u "$REDIS_URL" INFO memory
redis-cli -u "$REDIS_URL" DBSIZE
```

### Keys críticas (não flushar sem entender)

| Padrão | Propósito |
|--------|-----------|
| `refresh:*` | Famílias de refresh token |
| `pvp:queue` | Fila matchmaking PvP |
| `bull:*` | Jobs BullMQ |
| `ws:rl:*` | Rate limit WebSocket |
| `online:*` | Presence |

### Ação segura

1. Identificar keys grandes: `redis-cli --bigkeys`
2. Se BullMQ backlog enorme: processar ou limpar jobs **failed** via Bull Board (`ENABLE_BULL_BOARD=true`)
3. Aumentar `maxmemory` do Redis ou escalar instância

### ⚠️ Nunca em produção sem aprovação

`FLUSHALL` apaga refresh tokens → todos os usuários deslogados.

`FLUSHDB` mesmo efeito no DB atual.

---

## 3. BullMQ backlog

```bash
# Com Bull Board habilitado
# Acesse /admin/bull (credenciais BULL_BOARD_USER/PASSWORD)
```

Ou via redis-cli:

```bash
redis-cli -u "$REDIS_URL" KEYS "bull:*:wait"
```

Se worker parado: ver [`worker-stalled.md`](./worker-stalled.md).

---

## 4. Conexão recusada

- Verificar `REDIS_URL` (porta 6379 dev, 6380 Docker full stack)
- Container Redis down → `docker compose up -d redis`

---

## 5. Prevenção

- Monitorar `used_memory` vs `maxmemory`
- TTL em keys de presence (60s) e rate limit — já configurado no código
- Refresh tokens expiram por `REFRESH_TOKEN_MAX_AGE_SECONDS`
