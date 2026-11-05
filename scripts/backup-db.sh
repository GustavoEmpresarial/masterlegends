#!/usr/bin/env bash
# Backup automatizado — PostgreSQL (mll) + MongoDB (mll_logs)
# Agendado a cada 12h via cron (scripts/setup-backup-cron.sh). Retém 14 dias.
set -euo pipefail

MLL_DIR="${MLL_DIR:-/opt/mll}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/mll}"
KEEP_DAYS="${KEEP_DAYS:-14}"
TIMESTAMP="$(date +"%Y-%m-%d_%H-%M-%S")"

PG_CONTAINER="${PG_CONTAINER:-mll-postgres}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-mll}"

MONGO_CONTAINER="${MONGO_CONTAINER:-mll-mongo-logs}"
MONGO_USER="${MONGO_USER:-mll_mongo}"
MONGO_DB="${MONGO_DB:-mll_logs}"
MONGO_AUTH_DB="${MONGO_AUTH_DB:-admin}"

ENV_FILE="${MLL_DIR}/.env"

mkdir -p "${BACKUP_DIR}/postgres" "${BACKUP_DIR}/mongo" "${BACKUP_DIR}/logs"

LOG="${BACKUP_DIR}/logs/backup-${TIMESTAMP}.log"
exec > >(tee -a "$LOG") 2>&1

echo "===== MLL BACKUP — ${TIMESTAMP} ====="

require_container() {
  local name="$1"
  if ! docker ps --format '{{.Names}}' | grep -qx "$name"; then
    echo "[${name}] Container não está rodando — abortando."
    exit 1
  fi
}

load_mongo_password() {
  if [[ -n "${MONGO_PASSWORD:-}" ]]; then
    return 0
  fi
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "[mongo] WARN: ${ENV_FILE} não encontrado — pulando dump Mongo."
    return 1
  fi
  MONGO_PASSWORD="$(grep -E '^MONGO_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  MONGO_PASSWORD="${MONGO_PASSWORD%\"}"
  MONGO_PASSWORD="${MONGO_PASSWORD#\"}"
  if [[ -z "$MONGO_PASSWORD" ]]; then
    echo "[mongo] WARN: MONGO_PASSWORD ausente em .env — pulando dump Mongo."
    return 1
  fi
  return 0
}

require_container "$PG_CONTAINER"

PG_FILE="${BACKUP_DIR}/postgres/mll-postgres-${TIMESTAMP}.sql.gz"
echo "[postgres] Dumping ${PG_DB}..."
if docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" --clean --if-exists "$PG_DB" | gzip > "$PG_FILE"; then
  SIZE="$(du -sh "$PG_FILE" | cut -f1)"
  echo "[postgres] OK — ${PG_FILE} (${SIZE})"
  ln -sf "$(basename "$PG_FILE")" "${BACKUP_DIR}/postgres/latest.sql.gz"
else
  echo "[postgres] ERRO ao fazer dump!"
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx "$MONGO_CONTAINER"; then
  if load_mongo_password; then
    MONGO_FILE="${BACKUP_DIR}/mongo/mll-mongo-${TIMESTAMP}.archive.gz"
    echo "[mongo] Dumping ${MONGO_DB}..."
    if docker exec "$MONGO_CONTAINER" mongodump \
      --username "$MONGO_USER" \
      --password "$MONGO_PASSWORD" \
      --authenticationDatabase "$MONGO_AUTH_DB" \
      --db "$MONGO_DB" \
      --archive \
      --gzip > "$MONGO_FILE"; then
      SIZE="$(du -sh "$MONGO_FILE" | cut -f1)"
      echo "[mongo] OK — ${MONGO_FILE} (${SIZE})"
      ln -sf "$(basename "$MONGO_FILE")" "${BACKUP_DIR}/mongo/latest.archive.gz"
    else
      echo "[mongo] WARN: dump falhou (logs não críticos)."
      rm -f "$MONGO_FILE"
    fi
  fi
else
  echo "[mongo] Container ${MONGO_CONTAINER} não está rodando — pulando."
fi

echo "[cleanup] Removendo backups com mais de ${KEEP_DAYS} dias..."
find "${BACKUP_DIR}/postgres" -name "*.sql.gz" -mtime +"${KEEP_DAYS}" -delete
find "${BACKUP_DIR}/mongo" -name "*.archive.gz" -mtime +"${KEEP_DAYS}" -delete
find "${BACKUP_DIR}/logs" -name "backup-*.log" -mtime +"${KEEP_DAYS}" -delete

echo "===== BACKUP CONCLUÍDO — $(date +"%Y-%m-%d %H:%M:%S") ====="
