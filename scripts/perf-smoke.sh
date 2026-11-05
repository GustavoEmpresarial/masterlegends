#!/usr/bin/env bash
# Run k6 smoke if k6 is installed; otherwise write a skip report (exit 0).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_DIR="$ROOT/reports"
mkdir -p "$REPORT_DIR"
OUT="$REPORT_DIR/perf-smoke.md"
BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"

{
  echo "# Performance smoke report"
  echo ""
  echo "- Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "- BASE_URL: $BASE_URL"
  echo ""
} >"$OUT"

if ! command -v k6 >/dev/null 2>&1; then
  cat >>"$OUT" <<'EOF'
## Status: SKIPPED

`k6` binary not found on PATH.

### Future solution
- Install k6 in CI (`grafana/setup-k6-action` or apt package).
- Point `BASE_URL` at staging or a compose-started API.
- Expand to stress/spike/soak under `perf/` once a stable target exists.
EOF
  echo "[perf] k6 not installed — report written (skipped)"
  exit 0
fi

set +e
k6 run --summary-export="$REPORT_DIR/perf-smoke-summary.json" "$ROOT/perf/smoke.js"
CODE=$?
set -e

{
  echo "## Status: $([[ $CODE -eq 0 ]] && echo PASS || echo FAIL)"
  echo ""
  echo "Summary JSON: \`reports/perf-smoke-summary.json\`"
  echo ""
  echo "Metrics of interest: throughput (http_reqs), latency avg/p95/p99, failure rate."
} >>"$OUT"

exit "$CODE"
