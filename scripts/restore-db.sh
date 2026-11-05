#!/usr/bin/env bash
# Restaura PostgreSQL e/ou MongoDB a partir de arquivos gerados por backup-db.sh
# Uso: ./scripts/restore-db.sh postgres /opt/backups/mll/postgres/latest.sql.gz
#      ./scripts/restore-db.sh mongo   /opt/backups/mll/mongo/latest.archive.gz
set -euo pipefail

MLL_DIR="${MLL_DIR:-/opt/mll}"
ENV_FILE="${MLL_DIR}/.env"

PG_CONTAINER="${PG_CONTAINER:-mll-postgres}"
PG_USER="${PG_USER:-postgres}"
PG_DB="${PG_DB:-mll}"

MONGO_CONTAINER="${MONGO_CONTAINER:-mll-mongo-logs}"
MONGO_USER="${MONGO_USER:-mll_mongo}"
MONGO_DB="${MONGO_DB:-mll_logs}"
MONGO_AUTH_DB="${MONGO_AUTH_DB:-admin}"

usage() {
  cat <<'EOF'
Usage:
  restore-db.sh postgres <arquivo.sql.gz>
  restore-db.sh mongo    <arquivo.archive.gz>

ATENÇÃO: pare api/worker antes de restaurar Postgres:
  cd /opt/mll && docker compose ... stop api worker
EOF
}

TARGET="${1:-}"
FILE="${2:-}"

if [[ -z "$TARGET" || -z "$FILE" || ! -f "$FILE" ]]; then
  usage
  exit 1
fi

case "$TARGET" in
  postgres)
    echo "Restaurando PostgreSQL de ${FILE}..."
    gunzip -c "$FILE" | docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1
    echo "PostgreSQL restaurado."
    ;;
  mongo)
    MONGO_PASSWORD="$(grep -E '^MONGO_PASSWORD=' "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
    MONGO_PASSWORD="${MONGO_PASSWORD%\"}"
    MONGO_PASSWORD="${MONGO_PASSWORD#\"}"
    if [[ -z "$MONGO_PASSWORD" ]]; then
      echo "MONGO_PASSWORD não encontrado em ${ENV_FILE}"
      exit 1
    fi
    echo "Restaurando MongoDB (${MONGO_DB}) de ${FILE}..."
    docker exec -i "$MONGO_CONTAINER" mongorestore \
      --username "$MONGO_USER" \
      --password "$MONGO_PASSWORD" \
      --authenticationDatabase "$MONGO_AUTH_DB" \
      --db "$MONGO_DB" \
      --drop \
      --archive \
      --gzip < "$FILE"
    echo "MongoDB restaurado."
    ;;
  *)
    usage
    exit 1
    ;;
esac
