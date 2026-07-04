/**
 * ワークフローの純ロジック（DBアクセスなし）
 *
 * - title_pattern のプレースホルダ置換（定期起票のタイトル生成）
 * - テンプレステップ → run ステップのスナップショット生成
 * - テンプレステップの整合検証（seq 連番等）
 *
 * DBへの読み書きは API Route 側（運用タスク担当）で行うこと。
 */
import type { NewRunStep, WorkflowTemplateStep } from "./types";

/** 年月日（数値。month/day はゼロ埋めしない 1〜12 / 1〜31） */
export interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * 現在時刻を JST（UTC+9）の年月日に変換する。
 * Vercel Cron はUTCで動くため、サーバーの Date をそのまま使うと日付がずれる。
 * @param now 基準時刻（省略時は現在時刻）
 */
export function getJstDateParts(now: Date = new Date()): DateParts {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return {
    year: jst.getUTCFullYear(),
    month: jst.getUTCMonth() + 1,
    day: jst.getUTCDate(),
  };
}

/**
 * 指定年月の前月を返す（1月 → 前年12月）。
 * 末日締め精算のように「起票月の前月分」を扱うルールのタイトル生成に使う。
 */
export function previousMonth(parts: DateParts): { year: number; month: number } {
  if (parts.month === 1) return { year: parts.year - 1, month: 12 };
  return { year: parts.year, month: parts.month - 1 };
}

/**
 * title_pattern のプレースホルダを置換してタイトルを生成する。
 * 対応プレースホルダ:
 *   {year} {month} {day} … 起票日（JST）の年月日
 *   {prev_year} {prev_month} … 起票日の前月（末日締め精算など前月分を扱う場合に使用）
 * @param pattern 例: "{year}年{month}月 15日締め精算"
 * @param parts 起票日の年月日（getJstDateParts で取得）
 */
export function formatTitlePattern(pattern: string, parts: DateParts): string {
  const prev = previousMonth(parts);
  return pattern
    .replaceAll("{year}", String(parts.year))
    .replaceAll("{month}", String(parts.month))
    .replaceAll("{day}", String(parts.day))
    .replaceAll("{prev_year}", String(prev.year))
    .replaceAll("{prev_month}", String(prev.month));
}

/**
 * テンプレートの steps を workflow_run_steps へ INSERT する行に変換する（スナップショット）。
 * seq 昇順に整列し、未指定の任意項目は null に正規化する。
 * @param template steps を持つテンプレート（DB行 or シード定義）
 */
export function buildRunSteps(template: {
  steps: WorkflowTemplateStep[];
}): NewRunStep[] {
  return [...template.steps]
    .sort((a, b) => a.seq - b.seq)
    .map((s) => ({
      seq: s.seq,
      title: s.title,
      guide: s.guide ?? null,
      external_url: s.external_url ?? null,
      external_label: s.external_label ?? null,
      status: "todo" as const,
    }));
}

/**
 * テンプレステップの整合を検証し、問題があればエラーメッセージ配列を返す（空配列=OK）。
 * 検証内容: seq が1始まりの連番か / title・guide が空でないか /
 * external_url と external_label が対で指定されているか。
 */
export function validateTemplateSteps(steps: WorkflowTemplateStep[]): string[] {
  const errors: string[] = [];
  if (steps.length === 0) {
    errors.push("steps が空です");
    return errors;
  }
  const sorted = [...steps].sort((a, b) => a.seq - b.seq);
  sorted.forEach((s, i) => {
    if (s.seq !== i + 1) {
      errors.push(`seq が連番ではありません（期待: ${i + 1} / 実際: ${s.seq}）`);
    }
    if (!s.title.trim()) errors.push(`seq ${s.seq}: title が空です`);
    if (!s.guide.trim()) errors.push(`seq ${s.seq}: guide が空です`);
    if ((s.external_url == null) !== (s.external_label == null)) {
      errors.push(`seq ${s.seq}: external_url と external_label は対で指定してください`);
    }
  });
  return errors;
}
