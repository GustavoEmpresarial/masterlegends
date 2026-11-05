#!/usr/bin/env bash
# Register Telegram webhook for MLL bot.
# Only use when TELEGRAM_UPDATES_MODE=webhook AND Cloudflare allows Telegram IPs
# (WAF skip for /api/telegram/webhook). Prefer TELEGRAM_UPDATES_MODE=polling otherwise.
# Usage:
#   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... WEB_URL=https://masterlegends.online \
#     bash scripts/telegram-set-webhook.sh
set -euo pipefail

TOKEN="${TELEGRAM_BOT_TOKEN:?TELEGRAM_BOT_TOKEN required}"
SECRET="${TELEGRAM_WEBHOOK_SECRET:?TELEGRAM_WEBHOOK_SECRET required}"
BASE="${WEB_URL:-https://masterlegends.online}"
URL="${BASE%/}/api/telegram/webhook"

curl -sS "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  -d "url=${URL}" \
  -d "secret_token=${SECRET}" \
  -d "allowed_updates=[\"message\"]" | tee /dev/stderr | grep -q '"ok":true'

echo
echo "✅ Webhook set to ${URL}"
