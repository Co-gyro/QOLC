#!/usr/bin/env bash
# ============================================================
# QOLC 機密情報スキャン
#
# リポジトリ内に以下のパターンが含まれていないかチェックする:
#  - .NMK バイナリファイル
#  - Supabase Service Role キーらしき文字列
#  - 高エントロピーな base64 文字列の埋め込み
# ============================================================
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXIT_CODE=0

echo "[1/4] *.NMK ファイルの追跡確認..."
if git ls-files | grep -E '\.NMK$' >/dev/null; then
  echo "❌ ERROR: .NMK ファイルが git 追跡されています!"
  git ls-files | grep -E '\.NMK$'
  EXIT_CODE=1
else
  echo "✅ .NMK ファイルは追跡されていません"
fi

echo
echo "[2/4] Supabase Service Role キーの埋め込み確認..."
# JWT 形式 (eyJ...) の長い文字列を検出
HITS=$(git grep -nE 'eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]+' \
       -- ':!*.md' ':!*.lock' ':!package-lock.json' ':!yarn.lock' ':!.env.example' || true)
if [ -n "$HITS" ]; then
  echo "❌ ERROR: JWT形式の長い文字列が見つかりました:"
  echo "$HITS"
  EXIT_CODE=1
else
  echo "✅ JWT形式の文字列は見つかりませんでした"
fi

echo
echo "[3/4] ハードコードされた API キー候補の検出..."
HITS=$(git grep -nEi '(api[_-]?key|secret|password)\s*[:=]\s*["'\''][A-Za-z0-9]{20,}["'\'']' \
       -- ':!*.md' ':!*.lock' ':!package-lock.json' ':!tests/**' ':!.env.example' || true)
if [ -n "$HITS" ]; then
  echo "⚠️  WARN: API キー候補が見つかりました（手動確認推奨）:"
  echo "$HITS"
else
  echo "✅ ハードコードらしき値は見つかりませんでした"
fi

echo
echo "[4/4] .env.local が追跡されていないか..."
if git ls-files | grep -E '^\.env(\.local|\.production|\.development)$' >/dev/null; then
  echo "❌ ERROR: .env 系ローカルファイルが追跡されています!"
  git ls-files | grep -E '^\.env'
  EXIT_CODE=1
else
  echo "✅ .env ローカルファイルは追跡されていません"
fi

echo
if [ "$EXIT_CODE" -ne 0 ]; then
  echo "❌ Secret scan failed."
  exit "$EXIT_CODE"
fi
echo "✅ All secret checks passed."
