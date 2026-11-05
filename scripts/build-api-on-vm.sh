#!/usr/bin/env bash
# Build API on VM using Node 20 inside Docker (host Node 18 is NOT supported).
# Usage:
#   cd /opt/mll
#   chmod +x scripts/build-api-on-vm.sh
#   ./scripts/build-api-on-vm.sh --clean   # first run or after broken npm install
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_IMAGE="${MLL_BUILD_NODE_IMAGE:-node:20-bookworm}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.vm-infra.yml -f docker-compose.vm.yml"
CLEAN="${1:-}"

if [[ "$CLEAN" == "--clean" || "$CLEAN" == "clean" ]]; then
  echo "==> Removing node_modules (do not upload node_modules from your PC)"
  rm -rf "${ROOT}/node_modules" "${ROOT}/apps/api/node_modules" "${ROOT}/packages/shared/node_modules" "${ROOT}/packages/logging/node_modules"
fi

echo "==> Building @mll/api with ${NODE_IMAGE}"
docker run --rm \
  -v "${ROOT}:/app" \
  -w /app \
  -e npm_config_fetch_timeout=300000 \
  -e npm_config_fetch_retries=5 \
  -e CI=true \
  "${NODE_IMAGE}" \
  bash -euo pipefail -c '
    npm install --ignore-scripts
    npm run build -w @mll/shared
    npm run build -w @mll/logging
    cd apps/api && npx prisma generate && cd /app
    npm run build -w @mll/api
    test -f apps/api/dist/main.js
    echo "==> Build OK: apps/api/dist"
  '

echo "==> Rebuilding api container"
cd "${ROOT}"
${COMPOSE} build --no-cache api
${COMPOSE} up -d api

echo "==> Waiting for api health..."
sleep 8
code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/health || echo 000)
echo "Health via web proxy: HTTP ${code}"
docker ps --filter name=mll-api --format '{{.Names}} {{.Status}}'
