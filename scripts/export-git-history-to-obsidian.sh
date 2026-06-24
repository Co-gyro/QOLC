#!/usr/bin/env bash
#
# git コミット履歴を Markdown 化して Obsidian Vault に保存する。
# Obsidian の Vault は単なる .md フォルダなので、ここへ書き込めば反映される。
#
# 使い方:
#   ./scripts/export-git-history-to-obsidian.sh
#
# 出力先は環境変数で上書き可能:
#   VAULT="/path/to/Vault" ./scripts/export-git-history-to-obsidian.sh
#
set -euo pipefail

# --- 設定 ---------------------------------------------------------------
VAULT="${VAULT:-$HOME/Documents/Obsidian Vault}"
OUT_DIR="$VAULT/QOLC"
OUT="$OUT_DIR/git-history.md"

# リポジトリのルートで実行されている前提（cd せず git に解決させる）
REPO_NAME="$(basename "$(git rev-parse --show-toplevel)")"
TOTAL="$(git rev-list --count HEAD)"
GEN_DATE="$(git log -1 --format='%cd' --date=format:'%Y-%m-%d %H:%M')"

mkdir -p "$OUT_DIR"

# --- 生成 ---------------------------------------------------------------
{
  echo "---"
  echo "tags: [qolc, git, history]"
  echo "repo: $REPO_NAME"
  echo "total_commits: $TOTAL"
  echo "---"
  echo
  echo "# QOLC Git コミット履歴"
  echo
  echo "> リポジトリ: \`$REPO_NAME\` / 総コミット数: **$TOTAL** / 最終更新コミット: $GEN_DATE"
  echo

  # 月（YYYY-MM）ごとに見出し + テーブル。Conventional Commits の種別を分離して列化。
  git log --date=format:'%Y-%m' --format='%cd' | sort -ru | while read -r MONTH; do
    echo "## $MONTH"
    echo
    echo "| 日付 | コミット | 種別 | 概要 |"
    echo "|---|---|---|---|"
    git log --date=format:'%Y-%m-%d' --format='%cd%x09%h%x09%s' \
      | awk -F'\t' -v m="$MONTH" '
        index($1, m)==1 {
          date=$1; hash=$2; subj=$3;
          type="-";
          if (match(subj, /^[a-z]+(\([^)]*\))?!?:/)) {
            t=substr(subj, 1, RLENGTH); sub(/[:(].*/, "", t); type=t;
            sub(/^[a-z]+(\([^)]*\))?!?:[ ]*/, "", subj);
          }
          gsub(/\|/, "\\|", subj);
          printf "| %s | `%s` | %s | %s |\n", date, hash, type, subj;
        }'
    echo
  done
} > "$OUT"

echo "✅ 生成完了: $OUT  (総コミット数: $TOTAL)"
