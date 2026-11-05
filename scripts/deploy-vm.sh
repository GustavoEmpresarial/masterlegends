#!/usr/bin/env bash
# Safe deploy to the shared VM — never overwrites /opt/mll/.env (JWT/COOKIE secrets).
set -euo pipefail

VM_HOST="${MLL_VM_HOST:-root@177.7.47.139}"
VM_PORT="${MLL_VM_PORT:-2222}"
VM_DIR="${MLL_VM_DIR:-/opt/mll}"
VM_PASS="${MLL_VM_PASS:-VortexA9#Lumi}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export SSHPASS="$VM_PASS"
SSH="sshpass -e ssh -p ${VM_PORT} -o StrictHostKeyChecking=no"
RSYNC_SSH="sshpass -e ssh -p ${VM_PORT} -o StrictHostKeyChecking=no"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.vm-infra.yml -f docker-compose.vm-online.yml"

RSYNC_EXCLUDES=(
  --exclude node_modules
  --exclude .git
  --exclude coverage
  --exclude .cursor
  --exclude e2e/test-results
  --exclude '.env'
  --exclude '.env.admin'
  --exclude '.env.admin.literal'
  --exclude 'apps/api/.env'
  --exclude 'apps/web/.env'
  --exclude 'apps/web/.env.production'
  --exclude '*.env.bak*'
  # Uploads são conteúdo de produção (fotos de jogador, anexos de suporte etc.), não código —
  # nunca deixar o `rsync --delete` do deploy_full apagar o que só existe na VM porque não
  # existe na máquina local de quem está rodando o deploy.
  --exclude 'apps/api/uploads'
  --exclude 'apps/api/private-uploads'
)

RSYNC_PROTECT=()

usage() {
  cat <<'EOF'
Usage: scripts/deploy-vm.sh <target>

Targets:
  web     — frontend only (build + rsync dist + rebuild web container)
  api     — backend only (build dist + rsync + migrate + rebuild api)
  worker  — worker only (rsync source + rebuild worker container)
  hot-api — fast api patch (rsync dist + docker cp, no image rebuild)
  full          — build all locally + rsync + rebuild web, api and worker
  backup-setup  — instala cron de backup 12h na VM (opcional: --now)

Environment:
  MLL_VM_HOST  SSH target (default: root@177.7.47.139)
  MLL_VM_PORT  SSH port (default: 2222)
  MLL_VM_DIR   Remote project dir (default: /opt/mll)

Never regenerate JWT_SECRET / COOKIE_SECRET on deploy — that logs everyone out.
EOF
}

backup_remote_env() {
  $SSH "$VM_HOST" "test -f '${VM_DIR}/.env' && cp '${VM_DIR}/.env' '${VM_DIR}/.env.bak' || echo 'WARN: no .env on VM yet'"
}

remote_compose() {
  $SSH "$VM_HOST" "cd '${VM_DIR}' && ${COMPOSE} $*"
}

build_local_backend() {
  echo "==> Building backend packages locally (shared → logging → api)..."
  (cd "${ROOT}" && \
    npm run build -w @mll/shared && \
    npm run build -w @mll/logging && \
    npm run build -w @mll/api)
}

build_local_web() {
  echo "==> Building frontend locally (shared → web)..."
  (cd "${ROOT}" && npm run build -w @mll/shared && npm run build -w @mll/web)
}

build_local_all() {
  build_local_backend
  echo "==> Building frontend..."
  (cd "${ROOT}" && npm run build -w @mll/web)
}

ensure_api_dist() {
  if [[ ! -f "${ROOT}/apps/api/dist/main.js" ]]; then
    echo "WARN: apps/api/dist/main.js not found."
    build_local_backend
  fi
}

ensure_web_dist() {
  if [[ ! -f "${ROOT}/apps/web/dist/index.html" ]]; then
    echo "WARN: apps/web/dist/index.html not found."
    build_local_web
  fi
}

ensure_remote_upload_dirs() {
  echo "==> Ensuring upload volume permissions on VM (uid 1001 = appuser)..."
  $SSH "$VM_HOST" "mkdir -p \
    '${VM_DIR}/apps/api/uploads/notices' \
    '${VM_DIR}/apps/api/uploads/transparency' \
    '${VM_DIR}/apps/api/uploads/events' \
    '${VM_DIR}/apps/api/uploads/gear' \
    '${VM_DIR}/apps/api/uploads/avatars' \
    '${VM_DIR}/apps/api/uploads/bonecos' \
    '${VM_DIR}/apps/api/private-uploads' && \
    chown -R 1001:1001 '${VM_DIR}/apps/api/uploads' '${VM_DIR}/apps/api/private-uploads' 2>/dev/null || true"
}

health_check_api() {
  $SSH "$VM_HOST" "
    code=\$(docker exec mll-api wget -qO- http://127.0.0.1:3001/health 2>/dev/null | grep -c '\"ok\"' || echo 0)
    docker ps --filter name=mll-api --filter name=mll-web --filter name=mll-worker --format 'table {{.Names}}\t{{.Status}}' | head -6
    site=\$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:4000/ 2>/dev/null || echo 000)
    echo \"Site HTTP: \$site\"
    if test \"\$code\" = '1'; then echo '✅ API saudável'; else echo '❌ API não respondeu'; exit 1; fi
  "
}

deploy_web() {
  echo "==> Building frontend locally..."
  build_local_web
  echo "==> Deploy web to ${VM_HOST}:${VM_DIR}"
  backup_remote_env
  rsync -az -e "$RSYNC_SSH" --delete \
    "${RSYNC_EXCLUDES[@]}" \
    "${ROOT}/apps/web/dist/" "${VM_HOST}:${VM_DIR}/apps/web/dist/"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/apps/web/nginx.vm-online.conf" "${VM_HOST}:${VM_DIR}/apps/web/nginx.vm-online.conf"
  remote_compose "build --no-cache web"
  remote_compose "up -d --no-deps web"
  echo "==> Web deploy done"
}

deploy_api() {
  ensure_api_dist
  echo "==> Deploy api to ${VM_HOST}:${VM_DIR}"
  backup_remote_env
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/packages/shared/dist/" "${VM_HOST}:${VM_DIR}/packages/shared/dist/"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/packages/logging/dist/" "${VM_HOST}:${VM_DIR}/packages/logging/dist/"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/apps/api/dist/" "${VM_HOST}:${VM_DIR}/apps/api/dist/"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/apps/api/prisma/" "${VM_HOST}:${VM_DIR}/apps/api/prisma/"
  ensure_remote_upload_dirs
  remote_compose "build api"
  remote_compose "up -d --no-deps api"
  remote_compose "exec -T api npx prisma migrate deploy"
  echo "==> API deploy done"
}

deploy_worker() {
  echo "==> Deploy worker to ${VM_HOST}:${VM_DIR}"
  backup_remote_env
  rsync -az -e "$RSYNC_SSH" \
    "${RSYNC_EXCLUDES[@]}" \
    "${ROOT}/packages/shared/" "${VM_HOST}:${VM_DIR}/packages/shared/"
  rsync -az -e "$RSYNC_SSH" \
    "${RSYNC_EXCLUDES[@]}" \
    "${ROOT}/packages/logging/" "${VM_HOST}:${VM_DIR}/packages/logging/"
  rsync -az -e "$RSYNC_SSH" \
    "${RSYNC_EXCLUDES[@]}" \
    "${ROOT}/apps/worker/" "${VM_HOST}:${VM_DIR}/apps/worker/"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/apps/api/prisma/" "${VM_HOST}:${VM_DIR}/apps/api/prisma/"
  remote_compose "build worker"
  remote_compose "up -d --no-deps worker"
  echo "==> Worker deploy done"
}

deploy_hot_api() {
  ensure_api_dist
  echo "==> Hot-deploy api to ${VM_HOST}:${VM_DIR} (no image rebuild)"
  backup_remote_env
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/packages/shared/dist/" "${VM_HOST}:${VM_DIR}/packages/shared/dist/"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/packages/logging/dist/" "${VM_HOST}:${VM_DIR}/packages/logging/dist/"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/apps/api/dist/" "${VM_HOST}:${VM_DIR}/apps/api/dist/"
  $SSH "$VM_HOST" "set -e
    docker cp '${VM_DIR}/packages/shared/dist/.' mll-api:/app/packages/shared/dist/
    docker cp '${VM_DIR}/packages/logging/dist/.' mll-api:/app/packages/logging/dist/
    docker cp '${VM_DIR}/apps/api/dist/.' mll-api:/app/apps/api/dist/
    docker restart mll-api
    sleep 8
    code=\$(docker exec mll-api wget -qO- http://127.0.0.1:3001/health 2>/dev/null | grep -c '\"ok\"' || echo 0)
    echo \"Health check: ok=\$code\"
    docker ps --filter name=mll-api --format '{{.Names}} {{.Status}}'
    test \"\$code\" = '1'
  "
  echo "==> Hot API deploy done"
}

deploy_full() {
  echo "==> Full deploy to ${VM_HOST}:${VM_DIR}"
  build_local_all
  backup_remote_env
  rsync -az -e "$RSYNC_SSH" --delete \
    "${RSYNC_EXCLUDES[@]}" \
    "${RSYNC_PROTECT[@]}" \
    "${ROOT}/" "${VM_HOST}:${VM_DIR}/"
  ensure_remote_upload_dirs
  echo "==> Building containers on VM..."
  remote_compose "build web api worker 2>&1 | tail -10"
  remote_compose "up -d --no-deps api web worker 2>&1 | tail -8"
  echo "==> Running migrations..."
  remote_compose "exec -T api npx prisma migrate deploy 2>&1 | tail -5"
  echo "==> Verificando saúde dos containers..."
  sleep 10
  health_check_api
  echo "==> Full deploy done"
}

deploy_backup_setup() {
  local run_now="${2:-}"
  echo "==> Installing 12h backup cron on ${VM_HOST}"
  rsync -az -e "$RSYNC_SSH" \
    "${ROOT}/scripts/backup-db.sh" \
    "${ROOT}/scripts/setup-backup-cron.sh" \
    "${ROOT}/scripts/restore-db.sh" \
    "${VM_HOST}:${VM_DIR}/scripts/"
  $SSH "$VM_HOST" "chmod +x '${VM_DIR}/scripts/backup-db.sh' '${VM_DIR}/scripts/setup-backup-cron.sh' '${VM_DIR}/scripts/restore-db.sh' && \
    '${VM_DIR}/scripts/setup-backup-cron.sh' ${run_now}"
  echo "==> Backup cron setup done"
}

verify_env_stable() {
  echo "==> Checking .env stability on VM"
  $SSH "$VM_HOST" "cd '${VM_DIR}' && \
    if test -f .env; then md5sum .env; else echo 'MISSING: .env'; fi && \
    if test -f .env.bak; then echo 'backup:' && md5sum .env.bak; fi && \
    docker volume ls | grep -E 'redis_data|mll.*redis' || true"
}

TARGET="${1:-}"
EXTRA="${2:-}"
case "$TARGET" in
  web) deploy_web ;;
  api) deploy_api ;;
  worker) deploy_worker ;;
  hot-api) deploy_hot_api ;;
  full) deploy_full ;;
  backup-setup) deploy_backup_setup "$TARGET" "$EXTRA" ;;
  verify) verify_env_stable ;;
  -h|--help|help) usage ;;
  *)
    usage
    exit 1
    ;;
esac
