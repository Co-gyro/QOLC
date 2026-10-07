#!/bin/zsh
# QOLC Wallet の開発用サーバー（開発・デモ用 Supabase に向けて、ポート 3100 で起動）。
# .env.local（本番）は書き換えず、.env.local.dev の値で上書きして起動する。
set -euo pipefail
cd "$(dirname "$0")/.."
grep -q "tqmbxszimkavivwbbdjw" .env.local.dev || { echo "接続先が qolc-dev ではありません" >&2; exit 1; }
set -a; source ./.env.local.dev; set +a
export NEXT_PUBLIC_APP_URL="http://localhost:3100"
exec npx next dev -p 3100
