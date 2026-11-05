# Runbook: DB lag / indisponível

Sintoma: API lenta, timeouts Prisma, `Can't reach database server`, migrations falham.

---

## 1. Verificar conectividade

```bash
docker compose -f docker-compose.dev.yml ps postgres
# ou na stack completa:
docker compose ps postgres
```

Teste direto:

```bash
psql "$DATABASE_URL" -c "SELECT 1"
```

---

## 2. Conexões esgotadas

Sintoma: `too many connections` nos logs.

```sql
SELECT count(*) FROM pg_stat_activity;
SHOW max_connections;
```

Ações:
- Reiniciar API/worker (libera pool Prisma)
- Aumentar `max_connections` no Postgres (temporário)
- Reduzir réplicas da API se houver muitas instâncias

---

## 3. Migrations pendentes

Após deploy com schema novo:

```bash
npm run db:migrate
```

Dev (cria migration):

```bash
npm run db:migrate:dev
```

Nunca rodar `migrate dev` em produção.

---

## 4. Queries lentas

```bash
npm run db:studio
```

Verificar:
- Listings ativos sem índice (raro — schema tem índices)
- `AuditLog` crescendo sem retenção
- Transações longas bloqueando writes

---

## 5. Disco cheio

```bash
docker system df
docker volume ls
```

Postgres em Docker: volume `postgres_data`. Expandir disco ou limpar logs.

---

## 6. Recovery

Se Postgres corrompido:
1. Parar API e worker
2. Restaurar backup mais recente
3. Rodar `db:migrate` se backup é anterior ao último deploy
4. Reiniciar serviços

**Prevenção:** backup diário do volume Postgres em produção.
