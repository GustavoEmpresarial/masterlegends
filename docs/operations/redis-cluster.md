# Redis — escala horizontal e cluster

Hoje o MLL usa **Redis standalone** via `REDIS_URL` (ex.: `redis://localhost:6379`). Isso é suficiente para dev, Docker single-node e deploy VM atual.

Este doc descreve o que muda se você escalar **múltiplas instâncias** da API e/ou do worker.

---

## Quem usa Redis

| Consumidor | Cliente | Arquivo | Uso |
|------------|---------|---------|-----|
| API | `app.redis` | [`apps/api/src/plugins/redis.ts`](../../apps/api/src/plugins/redis.ts) | Refresh tokens, rate limit, fila PvP, presence |
| API | `app.redisQueue` | idem | BullMQ producer (`maxRetriesPerRequest: null`) |
| API | Socket.IO adapter | [`apps/api/src/gateway/socket.ts`](../../apps/api/src/gateway/socket.ts) | Broadcast multi-instância |
| Worker | `createQueueRedis()` | [`apps/worker/src/lib/redis.ts`](../../apps/worker/src/lib/redis.ts) | BullMQ consumers |

Todas as conexões hoje: `new Redis(config.REDIS_URL, { ... })`.

---

## Quando precisa de cluster (ou Redis gerenciado HA)

| Cenário | Standalone OK? |
|---------|----------------|
| 1 API + 1 worker (atual) | Sim |
| N réplicas API atrás de load balancer | **Socket.IO + rate limit** precisam do mesmo Redis; standalone com replica read-only **não basta** para writes |
| N workers BullMQ | Sim com **um** Redis central; vários workers competem pelas filas |
| Redis OOM ou SPOF inaceitável | Migrar para Redis Cluster, Sentinel ou managed (ElastiCache, Memorystore, etc.) |

**Risco sem cluster/HA:** perda do nó Redis = auth refresh, filas, PvP e sockets param juntos.

---

## BullMQ + Redis Cluster

BullMQ **suporta** Redis Cluster, mas exige configuração explícita — não basta trocar a URL.

### Requisitos BullMQ

1. Conexão com `maxRetriesPerRequest: null` (já usado em `redisQueue` e worker)
2. Para cluster: passar instância `Redis.Cluster` do ioredis, **não** URL simples
3. Chaves BullMQ usam hash tags `{bull}` — cluster precisa suportar multi-key ops no mesmo slot (BullMQ documenta prefixos compatíveis)

### Exemplo (referência — não implementado no repo)

```typescript
import Redis from 'ioredis';

const cluster = new Redis.Cluster(
  [
    { host: 'redis-node-1', port: 6379 },
    { host: 'redis-node-2', port: 6379 },
  ],
  {
    redisOptions: { maxRetriesPerRequest: null },
  },
);

// Worker / BullMQ
new Worker(QUEUE_NAME, processor, { connection: cluster });
```

Mudanças necessárias no código:

- [`apps/api/src/plugins/redis.ts`](../../apps/api/src/plugins/redis.ts) — factory que escolhe standalone vs cluster por env
- [`apps/worker/src/lib/redis.ts`](../../apps/worker/src/lib/redis.ts) — mesma factory
- [`apps/api/src/config/env.ts`](../../apps/api/src/config/env.ts) — ex.: `REDIS_CLUSTER_NODES` ou flag `REDIS_MODE=cluster`

---

## Socket.IO Redis adapter

O adapter [`@socket.io/redis-adapter`](https://socket.io/docs/v4/redis-adapter/) funciona com ioredis cluster **desde que** pub/sub clients apontem para o mesmo cluster.

Ao escalar API horizontalmente:

1. Todas as instâncias devem compartilhar o **mesmo** Redis (standalone ou cluster)
2. Sticky sessions no load balancer **não** substituem o adapter — WebSocket upgrade pode cair em qualquer nó

---

## Rate limit (`@fastify/rate-limit`)

Plugin atual: [`apps/api/src/plugins/rateLimit.ts`](../../apps/api/src/plugins/rateLimit.ts) passa `redis: app.redis`.

Com cluster, `app.redis` deve ser `Redis.Cluster` para contadores de rate limit serem globais entre réplicas.

---

## Variáveis de ambiente (proposta futura)

Hoje só existe `REDIS_URL`. Para cluster, padronizar algo como:

| Variável | Uso |
|----------|-----|
| `REDIS_URL` | Standalone (comportamento atual) |
| `REDIS_CLUSTER_NODES` | CSV `host:port,host:port` — se setado, usa cluster em vez de URL |

**Não implementado ainda** — documentado para planejamento de escala.

---

## Checklist antes de escalar horizontalmente

1. Redis centralizado acessível por todas as réplicas API/worker
2. BullMQ testado com carga em filas `email`, `chain-indexer`, `mining`
3. Socket.IO: verificar `pvp:matched` e `notification` entre duas instâncias API
4. Monitorar memória Redis (ver [`runbooks/redis-oom.md`](./runbooks/redis-oom.md))
5. Backup / persistência AOF/RDB se filas não podem ser perdidas

---

## Dev e CI

`docker-compose.dev.yml` e GitHub Actions usam **redis:7 single instance** — correto para testes. Não é necessário cluster local até simular multi-node em staging.
