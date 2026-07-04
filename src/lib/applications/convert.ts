/**
 * 加盟店申請（applications）→ 加盟店（merchants）への変換の純ロジック
 *
 * - 顧客入力（payload）+ UD追記（ud_input）+ 審査結果（ud_input.review）から
 *   merchants / merchant_applications へ INSERT する行を組み立てる。
 * - DB アクセスは行わない（API Route 側で実行する）。
 */
import type { ApplicationReview, UdInputFields } from "./ud-input";
import { summarizeReview } from "./ud-input";

/** 公開申請フォーム payload のうち変換に使うキー（merchantApplyFormSchema 準拠） */
export interface MerchantApplyPayload {
  corpName?: string;
  facilityName?: string;
  facilityAddress?: string;
  facilityPhone?: string;
  address?: string;
  phone?: string;
}

/** merchants へ INSERT する行（変換で設定する列のみ） */
export interface MerchantInsertRow {
  name: string;
  address: string | null;
  phone: string | null;
  jcb_merchant_code_recurring: string | null;
  jcb_merchant_code_ec: string | null;
  saison_merchant_code: string | null;
}

/** payload jsonb から変換に使う項目を安全に取り出す */
export function pickMerchantApplyPayload(
  payload: Record<string, unknown> | null | undefined
): MerchantApplyPayload {
  const s = (v: unknown): string | undefined =>
    typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
  const p = payload ?? {};
  return {
    corpName: s(p.corpName),
    facilityName: s(p.facilityName),
    facilityAddress: s(p.facilityAddress),
    facilityPhone: s(p.facilityPhone),
    address: s(p.address),
    phone: s(p.phone),
  };
}

/**
 * merchants への INSERT 行を組み立てる。
 * - 加盟店名は施設名（事業所名）を優先し、なければ法人名
 * - JCB 2種番号（登録型/都度型EC）とセゾン加盟店番号は審査結果から転記
 * @throws 加盟店名が決められない場合（payload に施設名も法人名もない）
 */
export function buildMerchantInsert(
  payload: MerchantApplyPayload,
  review: ApplicationReview
): MerchantInsertRow {
  const name = payload.facilityName ?? payload.corpName;
  if (!name) {
    throw new Error("加盟店名を決定できません（申請内容に施設名・法人名がありません）");
  }
  return {
    name,
    address: payload.facilityAddress ?? payload.address ?? null,
    phone: payload.facilityPhone ?? payload.phone ?? null,
    jcb_merchant_code_recurring: review.jcb?.merchant_code_recurring ?? null,
    jcb_merchant_code_ec: review.jcb?.merchant_code_ec ?? null,
    saison_merchant_code: review.saison?.merchant_code ?? null,
  };
}

/** merchant_applications へ upsert する行（審査記録の永続化先） */
export interface MerchantApplicationUpsertRow {
  merchant_id: string;
  application_id: string;
  status: "pending" | "reviewing" | "approved" | "rejected";
  submitted_at: string | null;
  result: "approved" | "rejected" | null;
  result_received_at: string | null;
  ng_reason: string | null;
  notes: string | null;
}

/** 日付文字列の配列から最小/最大を返す（YYYY-MM-DD 前提の辞書順比較） */
function minMaxDate(dates: Array<string | null | undefined>): {
  min: string | null;
  max: string | null;
} {
  const valid = dates.filter((d): d is string => !!d);
  if (valid.length === 0) return { min: null, max: null };
  const sorted = [...valid].sort();
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

/**
 * 審査結果（JCB/セゾン）を merchant_applications 1行へ集約する。
 * - status: 両社通過=approved / どちらか NG=rejected / 提出済み=reviewing / それ以外=pending
 * - notes: 会社別の内訳（JSON 文字列）を保持し、詳細の監査に使う
 */
export function buildMerchantApplicationUpsert(
  review: ApplicationReview,
  merchantId: string,
  applicationId: string
): MerchantApplicationUpsertRow {
  const summary = summarizeReview(review);
  const submitted = minMaxDate([review.jcb?.submitted_at, review.saison?.submitted_at]);
  const received = minMaxDate([
    review.jcb?.result_received_at,
    review.saison?.result_received_at,
  ]);
  const anySubmitted = submitted.min !== null;
  const status: MerchantApplicationUpsertRow["status"] = summary.allApproved
    ? "approved"
    : summary.anyRejected
      ? "rejected"
      : anySubmitted
        ? "reviewing"
        : "pending";
  const ngReasons = [
    review.jcb?.result === "rejected" && review.jcb.ng_reason
      ? `JCB: ${review.jcb.ng_reason}`
      : null,
    review.saison?.result === "rejected" && review.saison.ng_reason
      ? `セゾン: ${review.saison.ng_reason}`
      : null,
  ].filter((v): v is string => v !== null);
  return {
    merchant_id: merchantId,
    application_id: applicationId,
    status,
    submitted_at: submitted.min,
    result: summary.allApproved ? "approved" : summary.anyRejected ? "rejected" : null,
    result_received_at: received.max,
    ng_reason: ngReasons.length > 0 ? ngReasons.join(" / ") : null,
    notes: JSON.stringify({ jcb: review.jcb ?? null, saison: review.saison ?? null }),
  };
}

/**
 * 変換（加盟店登録）を実行できるか検証し、不可なら理由を返す（null=可）。
 * 少なくとも1社の審査通過が必要（片方の結果待ちでも運用上は登録を進められる）。
 */
export function validateConvertPreconditions(args: {
  merchantId: string | null;
  review: ApplicationReview;
  fields: UdInputFields;
}): string | null {
  if (args.merchantId) return "この申請はすでに加盟店へ変換済みです";
  const summary = summarizeReview(args.review);
  if (!summary.anyApproved) {
    return "審査通過前は加盟店登録できません（JCB・セゾンいずれかの審査結果を「通過」で登録してください）";
  }
  return null;
}
