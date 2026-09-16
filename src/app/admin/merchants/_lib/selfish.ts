/**
 * Selfish（精算システム）登録データの取得・送信クライアント（加盟店管理画面用）
 *
 * データの組み立てはサーバー（/api/admin/merchants/[id]/selfish）で行い、
 * 画面はチェックリストとペイロードを表示するだけ。送信も同 API 経由で監査ログを残す。
 */
import type { SelfishIssue, SelfishMerchantPayload } from "@/lib/selfish/build-payload";
import type { SelfishLastRegistration } from "@/lib/selfish/load-source";

/** GET の応答 */
export interface SelfishPreview {
  merchant_name: string;
  application_id: string | null;
  payload: SelfishMerchantPayload;
  issues: SelfishIssue[];
  ready: boolean;
  /** 連携先（SELFISH_API_BASE_URL / SELFISH_PARTNER_KEY）が設定済みか */
  configured: boolean;
  last: SelfishLastRegistration | null;
}

/** POST の応答 */
export interface SelfishRegisterResponse {
  result: "created" | "updated" | "unchanged";
  request_id: string;
  selfish_merchant_id: string | null;
}

type ApiJson<T> = { success: true; data: T } | { success: false; error: string; code?: string };

/** 登録データとチェックリストを取得する */
export async function fetchSelfishPreview(merchantId: string): Promise<SelfishPreview> {
  const res = await fetch(`/api/admin/merchants/${merchantId}/selfish`, { cache: "no-store" });
  const json = (await res.json()) as ApiJson<SelfishPreview>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

/** Selfish へ送信する（サーバー側で再構築・署名） */
export async function registerToSelfish(merchantId: string): Promise<SelfishRegisterResponse> {
  const res = await fetch(`/api/admin/merchants/${merchantId}/selfish`, { method: "POST" });
  const json = (await res.json()) as ApiJson<SelfishRegisterResponse>;
  if (!json.success) throw new Error(json.error);
  return json.data;
}

/** 修正先の画面ラベル */
export const SELFISH_FIX_LABELS: Record<SelfishIssue["fix"], string> = {
  ud_input: "申請詳細の「UD追記情報」で入力",
  card_codes: "この画面の「番号を編集」で登録",
  merchant: "この画面の「編集」で修正",
  application: "元申請（申請/タスク）を確認",
};
