#!/usr/bin/env bash
# Build frontend on the VM using Node 20 inside Docker (host Node 18 is NOT supported).
# Usage (on VM, after uploading src via FileZilla):
#   cd /opt/mll
#   chmod +x scripts/build-web-on-vm.sh
#   ./scripts/build-web-on-vm.sh          # build dist + rebuild web container
#   ./scripts/build-web-on-vm.sh --clean  # wipe node_modules first (recommended first run)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_IMAGE="${MLL_BUILD_NODE_IMAGE:-node:20-bookworm}"
if [[ -f "${ROOT}/docker-compose.vm-online.yml" ]]; then
  COMPOSE="docker compose -f docker-compose.yml -f docker-compose.vm-infra.yml -f docker-compose.vm-online.yml"
else
  COMPOSE="docker compose -f docker-compose.yml -f docker-compose.vm-infra.yml -f docker-compose.vm.yml"
fi
CLEAN="${1:-}"

if [[ "$CLEAN" == "--clean" || "$CLEAN" == "clean" ]]; then
  echo "==> Removing node_modules (do not upload node_modules from your PC)"
  rm -rf "${ROOT}/node_modules" "${ROOT}/apps/web/node_modules" "${ROOT}/packages/shared/node_modules"
fi

echo "==> Building @mll/web with ${NODE_IMAGE} (Node 20 inside Docker)"
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
    npm run build -w @mll/web
    test -f apps/web/dist/index.html
    echo "==> Build OK: apps/web/dist"
  '

echo "==> Rebuilding nginx web container"
cd "${ROOT}"
${COMPOSE} build --no-cache web
${COMPOSE} up -d web

echo "==> Done. Open http://84.54.23.199:8000/ and hard refresh (Ctrl+Shift+R)"
