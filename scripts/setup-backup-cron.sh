#!/usr/bin/env bash
# Instala cron de backup a cada 12h na VM (00:00 e 12:00).
# Uso na VM: ./scripts/setup-backup-cron.sh [--now]
# Ou da máquina local: ./scripts/deploy-vm.sh backup-setup [--now]
set -euo pipefail

MLL_DIR="${MLL_DIR:-/opt/mll}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/mll}"
BACKUP_SCRIPT="${MLL_DIR}/scripts/backup-db.sh"
CRON_MARKER="# mll-backup-12h"
CRON_LINE="0 */12 * * * ${BACKUP_SCRIPT} >> ${BACKUP_DIR}/logs/cron.log 2>&1 ${CRON_MARKER}"

RUN_NOW=false
for arg in "$@"; do
  case "$arg" in
    --now) RUN_NOW=true ;;
  esac
done

if [[ ! -x "$BACKUP_SCRIPT" ]]; then
  chmod +x "$BACKUP_SCRIPT"
fi

mkdir -p "${BACKUP_DIR}/postgres" "${BACKUP_DIR}/mongo" "${BACKUP_DIR}/logs"

if crontab -l 2>/dev/null | grep -qF "$CRON_MARKER"; then
  echo "Cron de backup já instalado."
else
  (
    crontab -l 2>/dev/null || true
    echo "$CRON_LINE"
  ) | crontab -
  echo "Cron instalado: a cada 12 horas (00:00 e 12:00)."
  echo "  ${CRON_LINE}"
fi

echo "Backups em: ${BACKUP_DIR}"
echo "Retenção: 14 dias"

if [[ "$RUN_NOW" == true ]]; then
  echo "==> Executando backup inicial..."
  "$BACKUP_SCRIPT"
fi
