#!/usr/bin/env bash
# Example: daily CurrencyAPI sync on a Linux VPS.
# 1. Copy to e.g. /opt/operation-automation/scripts/daily-currency-fx.sh
# 2. chmod +x
# 3. Point cron at it (see docs/vps-hosting.md)
set -euo pipefail

APP_BASE_URL="${APP_BASE_URL:-https://your-app.example.com}"
CRON_SECRET="${CRON_SECRET:?Set CRON_SECRET in the environment or source a .env file before running}"

curl -fsS -X POST "${APP_BASE_URL}/api/cron/currency-fx" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Accept: application/json"

echo "OK $(date -Is)"
