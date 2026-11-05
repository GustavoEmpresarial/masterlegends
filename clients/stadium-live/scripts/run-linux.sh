#!/usr/bin/env bash
# Atalho Linux: roda o widget sem empacotar (precisa de npm install + Electron).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export MLL_BASE_URL="${MLL_BASE_URL:-http://localhost:3000}"
if [[ ! -d node_modules/electron ]]; then
  echo "Instalando deps…"
  npm install
fi
exec npx electron .
