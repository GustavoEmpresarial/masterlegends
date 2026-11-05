# Backup automático (12h)

Backups de **PostgreSQL** (dados do jogo) e **MongoDB** (logs) na VM de produção.

## O que é feito

| Componente | Frequência | Retenção | Destino |
|---|---|---|---|
| Postgres (`mll`) | A cada 12h (00:00 e 12:00) | 14 dias | `/opt/backups/mll/postgres/` |
| Mongo (`mll_logs`) | Idem | 14 dias | `/opt/backups/mll/mongo/` |

Symlinks `latest.sql.gz` e `latest.archive.gz` apontam para o backup mais recente.

## Instalação na VM

Da máquina de dev (já com SSH configurado):

```bash
./scripts/deploy-vm.sh backup-setup --now
```

Na VM diretamente:

```bash
cd /opt/mll
chmod +x scripts/backup-db.sh scripts/setup-backup-cron.sh scripts/restore-db.sh
./scripts/setup-backup-cron.sh --now
```

## Backup manual

```bash
/opt/mll/scripts/backup-db.sh
```

## Restaurar

1. Pare API e worker: `docker compose ... stop api worker`
2. Restaure Postgres:
   ```bash
   /opt/mll/scripts/restore-db.sh postgres /opt/backups/mll/postgres/latest.sql.gz
   ```
3. (Opcional) Restaure logs Mongo:
   ```bash
   /opt/mll/scripts/restore-db.sh mongo /opt/backups/mll/mongo/latest.archive.gz
   ```
4. Suba os serviços: `docker compose ... up -d api worker`

## Verificar cron

```bash
crontab -l | grep mll-backup
ls -lh /opt/backups/mll/postgres/
tail -20 /opt/backups/mll/logs/cron.log
```

## Copiar backup para fora da VM

```bash
scp -P 2222 root@177.7.47.139:/opt/backups/mll/postgres/latest.sql.gz ./mll-backup.sql.gz
```

Guarde cópias off-site periodicamente — disco local da VM não protege contra perda total da máquina.
