#!/bin/sh
set -e

if ! npx prisma migrate deploy; then
  echo "WARN: prisma migrate deploy failed — syncing schema (local/stale DB)"
  npx prisma db push --skip-generate --accept-data-loss
fi

exec node dist/main.js
