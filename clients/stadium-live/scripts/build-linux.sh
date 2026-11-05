#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export MLL_BASE_URL="${MLL_BASE_URL:-http://143.20.50.96}"
npm install
npm run pack:linux
echo ""
echo "Linux builds em: $ROOT/release/"
ls -lah release/*linux* release/linux-unpacked/MLL\ Stadium\ Live 2>/dev/null || ls -lah release/
