#!/usr/bin/env bash
#
# SessionEnd フック: 終了した会話のトランスクリプトを headless Claude に渡し、
# 恒久的に価値のある学び(ノウハウ・ユーザーの特徴・失敗と対応)を
# プロジェクトの永続メモリへ自動追記する。
#
# - セッション終了をブロックしないよう、抽出はバックグラウンドへ完全デタッチして起動する。
# - 抽出用の headless Claude 自身も終了時にこのフックを呼ぶため、環境変数で再帰を防ぐ。
#
# stdin には SessionEnd フックの JSON (transcript_path, reason, session_id, cwd ...) が渡る。
set -euo pipefail

# --- 再帰ガード: 抽出ジョブから起動された Claude では何もしない ---------------
if [ "${CLAUDE_MEMORY_EXTRACT:-}" = "1" ]; then
  exit 0
fi

# --- 設定(環境変数で上書き可) ----------------------------------------------
MIN_LINES="${MEMORY_EXTRACT_MIN_LINES:-15}"   # これ未満の短い会話はスキップ
EXTRACT_MODEL="${MEMORY_EXTRACT_MODEL:-}"     # 空ならユーザー既定モデル
# 学びを人が閲覧する用に Obsidian Vault へもミラーする(両方保存)
OBSIDIAN_DIR="${MEMORY_OBSIDIAN_DIR:-$HOME/Documents/Obsidian Vault/QOLC/ノウハウ}"

CLAUDE_BIN="$(command -v claude || true)"
JQ_BIN="$(command -v jq || true)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMPT_TEMPLATE="$SCRIPT_DIR/memory-extract-prompt.md"

# 必須ツールが無ければ静かに終了(フックは失敗させない)
[ -z "$CLAUDE_BIN" ] && exit 0
[ -z "$JQ_BIN" ] && exit 0
[ -f "$PROMPT_TEMPLATE" ] || exit 0

# --- 入力の取り出し ----------------------------------------------------------
INPUT="$(cat)"
TRANSCRIPT="$(printf '%s' "$INPUT" | "$JQ_BIN" -r '.transcript_path // empty')"

[ -z "$TRANSCRIPT" ] && exit 0
[ -f "$TRANSCRIPT" ] || exit 0

# 短すぎる会話(挨拶だけ等)はコスト節約のためスキップ
LINES="$(wc -l < "$TRANSCRIPT" | tr -d ' ')"
[ "${LINES:-0}" -lt "$MIN_LINES" ] && exit 0

# メモリディレクトリはトランスクリプトと同じプロジェクトフォルダ配下
PROJECT_DIR="$(dirname "$TRANSCRIPT")"
MEMORY_DIR="$PROJECT_DIR/memory"
mkdir -p "$MEMORY_DIR"
mkdir -p "$OBSIDIAN_DIR"
LOG="$MEMORY_DIR/.auto-extract.log"

# --- プロンプト生成(プレースホルダ置換) -----------------------------------
PROMPT="$(sed \
  -e "s#{{TRANSCRIPT}}#$TRANSCRIPT#g" \
  -e "s#{{MEMORY_DIR}}#$MEMORY_DIR#g" \
  -e "s#{{OBSIDIAN_DIR}}#$OBSIDIAN_DIR#g" \
  "$PROMPT_TEMPLATE")"

MODEL_ARGS=()
[ -n "$EXTRACT_MODEL" ] && MODEL_ARGS=(--model "$EXTRACT_MODEL")

# --- バックグラウンドで抽出を起動(デタッチ) -------------------------------
# CLAUDE_MEMORY_EXTRACT=1 で、この headless 実行が終了しても再帰しないようにする。
{
  printf '\n===== %s (lines=%s, reason=%s) =====\n' \
    "$(date '+%Y-%m-%d %H:%M:%S')" "$LINES" \
    "$(printf '%s' "$INPUT" | "$JQ_BIN" -r '.reason // "-"')" >> "$LOG"

  # ${arr[@]+...} ガードで、空配列 + set -u(bash 3.2)でも落ちないようにする
  CLAUDE_MEMORY_EXTRACT=1 "$CLAUDE_BIN" -p "$PROMPT" \
    --permission-mode acceptEdits \
    --add-dir "$MEMORY_DIR" \
    --add-dir "$OBSIDIAN_DIR" \
    ${MODEL_ARGS[@]+"${MODEL_ARGS[@]}"} \
    >> "$LOG" 2>&1
} </dev/null >/dev/null 2>&1 &

disown || true
exit 0
