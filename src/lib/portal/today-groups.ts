/**
 * 「今日のUD」業務別グルーピングの純ロジック
 *
 * v2（業務ファースト構成）: 今日動くべきものをサイドバーの業務単位でまとめ、
 * 各行はポップアップではなく該当業務ページ（?open= ディープリンク）へ遷移する。
 * すべて純関数（DBアクセス・現在時刻取得なし。todayStr は呼び出し側で注入）。
 */
import {
  SOURCE_LABELS,
  STATUS_LABELS,
  type ApplicationStatus,
} from "@/lib/applications/labels";
import { hubHrefOfSource } from "@/lib/applications/hub-tabs";
import {
  OPEN_OPS_STATUSES,
  OPS_STATUS_LABELS,
  type OpsTask,
} from "@/lib/ops-tasks/logic";
import { computeRunProgress, isOverdue } from "./workflow-logic";
import type { PoolAvailability } from "./admin-queries";
import type { PaymentAlertCounts, TodayApplication, TodayRun } from "./today-queries";

/** プール残数がこの件数を下回ったら警告行を出す（alerts-section から踏襲） */
export const POOL_WARN_THRESHOLD = 10;

/** 1グループに表示する最大行数（超過分は「ほか n 件」でページへ誘導） */
export const GROUP_ITEM_LIMIT = 5;

/** バッジの見た目種別（new=新着 / doing=対応中 / alert=要対応 / calm=情報） */
export type TodayItemTone = "new" | "doing" | "alert" | "calm";

export interface TodayGroupItem {
  id: string;
  href: string;
  title: string;
  /** 補足（受付日・進捗・次アクションなど） */
  sub: string;
  badge: { label: string; tone: TodayItemTone };
  /** 並べ替え用（アラート→新着→期限順） */
  dueDate: string | null;
}

export interface TodayGroup {
  key: "inquiries" | "merchant" | "daily_payment" | "settlement" | "other";
  label: string;
  /** グループ全体の入口（見出しのリンク先） */
  href: string;
  items: TodayGroupItem[];
  /** 表示上限で省略した件数 */
  extraCount: number;
}

/** dueDate 昇順（null は最後） */
function compareDue(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

/** tone の優先度（alert → new → doing → calm） */
const TONE_ORDER: Record<TodayItemTone, number> = { alert: 0, new: 1, doing: 2, calm: 3 };

function sortItems(items: TodayGroupItem[]): TodayGroupItem[] {
  return [...items].sort(
    (a, b) => TONE_ORDER[a.badge.tone] - TONE_ORDER[b.badge.tone] || compareDue(a.dueDate, b.dueDate)
  );
}

/** 申請/相談 → 行（状態でバッジを出し分け） */
function appToItem(a: TodayApplication): TodayGroupItem {
  const tone: TodayItemTone = a.status === "new" ? "new" : "doing";
  const name = a.applicantOrg ?? a.applicantName ?? "（申請者不明）";
  return {
    id: `app-${a.id}`,
    href: hubHrefOfSource(a.source, a.id),
    title: name,
    sub: a.nextAction
      ? `${SOURCE_LABELS[a.source]}・次: ${a.nextAction}`
      : SOURCE_LABELS[a.source],
    badge: { label: STATUS_LABELS[a.status as ApplicationStatus], tone },
    dueDate: a.dueDate,
  };
}

/** workflow run → 行（期限超過はアラート表示） */
function runToItem(r: TodayRun, todayStr: string): TodayGroupItem {
  const p = computeRunProgress(r.stepStatuses);
  const overdue = isOverdue(r.dueDate, todayStr);
  return {
    id: `run-${r.id}`,
    href: `/admin/tasks/${r.id}`,
    title: r.title,
    sub: `工程 ${p.done + p.skipped}/${p.total}${r.dueDate ? `・期限 ${r.dueDate}` : ""}`,
    badge: overdue
      ? { label: "期限超過", tone: "alert" }
      : { label: "進行中", tone: "doing" },
    dueDate: r.dueDate,
  };
}

function toGroup(
  key: TodayGroup["key"],
  label: string,
  href: string,
  items: TodayGroupItem[]
): TodayGroup {
  const sorted = sortItems(items);
  return {
    key,
    label,
    href,
    items: sorted.slice(0, GROUP_ITEM_LIMIT),
    extraCount: Math.max(0, sorted.length - GROUP_ITEM_LIMIT),
  };
}

/** "YYYY-MM-DD" に日数を加算する（今日のUDの「期限接近」判定用） */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 期限接近とみなす日数（今日+3日以内） */
export const OPS_DUE_SOON_DAYS = 3;

/**
 * その他業務タスクを今日のUDに出すか。
 * 全未完了を出すと溢れるため、「対応中」「期限超過」「期限が3日以内」に絞る。
 */
export function opsTaskNeedsAttention(t: OpsTask, todayStr: string): boolean {
  if (t.status === "in_progress") return true;
  if (!t.dueDate) return false;
  return t.dueDate <= addDaysToDateStr(todayStr, OPS_DUE_SOON_DAYS);
}

/** ops_task → 行（期限超過はアラート・保留は情報扱い） */
function opsTaskToItem(t: OpsTask, todayStr: string): TodayGroupItem {
  const overdue = !!t.dueDate && t.dueDate < todayStr;
  const tone: TodayItemTone = overdue
    ? "alert"
    : t.status === "todo"
      ? "new"
      : t.status === "on_hold"
        ? "calm"
        : "doing";
  return {
    id: `ops-${t.id}`,
    href: "/admin/other-tasks",
    title: t.title,
    sub: `${t.category ?? "その他"}${t.dueDate ? `・期限 ${t.dueDate}` : ""}`,
    badge: { label: overdue ? "期限超過" : OPS_STATUS_LABELS[t.status], tone },
    dueDate: t.dueDate,
  };
}

/**
 * 今日のUD の業務別グループを組み立てる。
 * @param apps 未完了の申請/相談
 * @param runs 進行中の workflow run
 * @param payments 決済アラート件数（取得失敗時 null）
 * @param pool 採番プール残数（取得失敗時 null）
 * @param todayStr JST の "YYYY-MM-DD"（期限超過判定用）
 * @param opsTasks その他業務タスク（未完了のみ渡す。テーブル未適用時は空配列）
 */
export function buildTodayGroups(
  apps: TodayApplication[],
  runs: TodayRun[],
  payments: PaymentAlertCounts | null,
  pool: PoolAvailability | null,
  todayStr: string,
  opsTasks: OpsTask[] = []
): TodayGroup[] {
  // 相談・問い合わせ（加盟店申請以外の全 source）
  const inquiryItems = apps
    .filter((a) => a.source !== "qolc_merchant")
    .map(appToItem);

  // 加盟店申請・登録（申請案件 + 申請系の工程 run + 採番プール警告）
  const merchantItems: TodayGroupItem[] = [
    ...apps.filter((a) => a.source === "qolc_merchant").map(appToItem),
    ...runs.filter((r) => r.category === "merchant").map((r) => runToItem(r, todayStr)),
  ];
  if (pool && pool.mallCode.available < POOL_WARN_THRESHOLD) {
    merchantItems.push({
      id: "pool-mall",
      href: "/admin/master",
      title: `モールコードの残りが ${pool.mallCode.available} 件です`,
      sub: "枯渇前に追加発番の手配が必要です",
      badge: { label: "残数僅少", tone: "alert" },
      dueDate: null,
    });
  }
  if (pool && pool.terminalId.available < POOL_WARN_THRESHOLD) {
    merchantItems.push({
      id: "pool-terminal",
      href: "/admin/master",
      title: `端末識別番号の残りが ${pool.terminalId.available} 件です`,
      sub: "枯渇前に追加発番の手配が必要です",
      badge: { label: "残数僅少", tone: "alert" },
      dueDate: null,
    });
  }

  // 日次決済（決済エラー・保留 + 日次運用 run）
  const paymentItems: TodayGroupItem[] = [];
  if (payments && payments.failed > 0) {
    paymentItems.push({
      id: "pay-failed",
      href: "/admin/payments?status=failed",
      title: `失敗した決済が ${payments.failed} 件あります`,
      sub: "カード有効期限切れ等の対応が必要です",
      badge: { label: "決済エラー", tone: "alert" },
      dueDate: null,
    });
  }
  if (payments && payments.pending > 0) {
    paymentItems.push({
      id: "pay-pending",
      href: "/admin/payments",
      title: `保留中の決済が ${payments.pending} 件あります`,
      sub: "保留理由を確認して再実行または取消してください",
      badge: { label: "保留", tone: "doing" },
      dueDate: null,
    });
  }
  paymentItems.push(
    ...runs.filter((r) => r.category === "daily").map((r) => runToItem(r, todayStr))
  );

  // 月次精算（settlement run）
  const settlementItems = runs
    .filter((r) => r.category === "settlement")
    .map((r) => runToItem(r, todayStr));

  // その他業務（ops_tasks の未完了 + カテゴリ未設定・未知カテゴリの run の受け皿）
  const known = new Set(["merchant", "daily", "settlement"]);
  const otherItems = [
    ...opsTasks
      .filter((t) => OPEN_OPS_STATUSES.includes(t.status) && opsTaskNeedsAttention(t, todayStr))
      .map((t) => opsTaskToItem(t, todayStr)),
    ...runs
      .filter((r) => !r.category || !known.has(r.category))
      .map((r) => runToItem(r, todayStr)),
  ];

  return [
    toGroup("inquiries", "相談・問い合わせ", "/admin/inquiries", inquiryItems),
    toGroup("merchant", "加盟店申請・登録", "/admin/applications", merchantItems),
    toGroup("daily_payment", "日次決済", "/admin/payments", paymentItems),
    toGroup("settlement", "月次精算・チェック", "/admin/tasks", settlementItems),
    toGroup("other", "その他業務", "/admin/other-tasks", otherItems),
  ];
}
