/**
 * 申請/タスク ハブの列挙値・日本語ラベル定義（migration 029/031 の ENUM と1対1対応）
 */

/**
 * 申請の種別。
 * qolc_merchant=加盟店申請 / jcb_consult=住み替え相談 / contact=お問い合わせ /
 * support_facility=施設サポート / support_family=ご家族サポート /
 * support_provider=提供者サポート（後4種は migration 031 で追加）
 */
export type ApplicationSource =
  | "qolc_merchant"
  | "jcb_consult"
  | "contact"
  | "support_facility"
  | "support_family"
  | "support_provider";

/** 対応状態（new=新規 / in_progress=対応中 / waiting=相手待ち / done=完了 / rejected=却下） */
export type ApplicationStatus =
  | "new"
  | "in_progress"
  | "waiting"
  | "done"
  | "rejected";

/** 優先度（low=低 / normal=中 / high=高） */
export type ApplicationPriority = "low" | "normal" | "high";

/**
 * 変更履歴（application_events.kind）の種別。
 * comment / email_sent / converted は migration 031 で追加
 * （comment=対応メモ。既存の commented=コメント とは別イベント）
 * ud_input_updated / review_registered / workflow_started は
 * 申請パイプライン（UD追記・審査結果・工程起票）の記録用（kind は TEXT のため
 * DB 側の DDL 変更は不要。コメント管理方式に準拠して追加）。
 */
export type ApplicationEventKind =
  | "created"
  | "status_changed"
  | "assigned"
  | "priority_changed"
  | "due_changed"
  | "next_action"
  | "commented"
  | "comment"
  | "email_sent"
  | "converted"
  | "ud_input_updated"
  | "review_registered"
  | "workflow_started"
  | "codes_assigned"
  | "payload_updated";

/** 種別の日本語ラベル */
export const SOURCE_LABELS: Record<ApplicationSource, string> = {
  qolc_merchant: "加盟店申請",
  jcb_consult: "住み替え相談",
  contact: "お問い合わせ",
  support_facility: "施設サポート",
  support_family: "ご家族サポート",
  support_provider: "提供者サポート",
};

/** 状態の日本語ラベル */
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "新規",
  in_progress: "対応中",
  waiting: "相手待ち",
  done: "完了",
  rejected: "却下",
};

/** 優先度の日本語ラベル */
export const PRIORITY_LABELS: Record<ApplicationPriority, string> = {
  low: "低",
  normal: "中",
  high: "高",
};

/** 変更履歴の種別ラベル */
export const EVENT_KIND_LABELS: Record<ApplicationEventKind, string> = {
  created: "受付",
  status_changed: "状態変更",
  assigned: "担当者変更",
  priority_changed: "優先度変更",
  due_changed: "期限変更",
  next_action: "次アクション更新",
  commented: "コメント",
  comment: "対応メモ",
  email_sent: "メール送信",
  converted: "加盟店へ変換",
  ud_input_updated: "UD追記情報更新",
  review_registered: "審査結果登録",
  workflow_started: "申請工程開始",
  codes_assigned: "採番（モールコード・端末番号）",
  payload_updated: "申請内容の編集",
};

/** 「未対応」とみなす状態（既定フィルタで表示する対象） */
export const OPEN_STATUSES: readonly ApplicationStatus[] = [
  "new",
  "in_progress",
  "waiting",
];

/** 状態バッジの配色（status-badge とは別に本ハブ専用に定義） */
export const STATUS_COLORS: Record<ApplicationStatus, { bg: string; fg: string }> = {
  new: { bg: "#E0F2FE", fg: "#0369A1" },
  in_progress: { bg: "#FFF7E6", fg: "#B45309" },
  waiting: { bg: "#FAE8FF", fg: "#86198F" },
  done: { bg: "#E6F4EA", fg: "#1B5E20" },
  rejected: { bg: "#FEE2E2", fg: "#991B1B" },
};

/** 優先度バッジの配色 */
export const PRIORITY_COLORS: Record<ApplicationPriority, { bg: string; fg: string }> = {
  low: { bg: "#F3F4F6", fg: "#4B5563" },
  normal: { bg: "#E0F2FE", fg: "#0369A1" },
  high: { bg: "#FEE2E2", fg: "#991B1B" },
};

export const ALL_STATUSES: readonly ApplicationStatus[] = [
  "new",
  "in_progress",
  "waiting",
  "done",
  "rejected",
];

export const ALL_PRIORITIES: readonly ApplicationPriority[] = [
  "low",
  "normal",
  "high",
];

export const ALL_SOURCES: readonly ApplicationSource[] = [
  "qolc_merchant",
  "jcb_consult",
  "contact",
  "support_facility",
  "support_family",
  "support_provider",
];
