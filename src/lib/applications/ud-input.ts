/**
 * applications.ud_input（UD追記情報 jsonb）の型と純ロジック
 *
 * ud_input は顧客入力（payload）と分離した UD 側の追記領域で、次の構造を持つ:
 *   { ...UdInputFields, review?: { jcb?: CompanyReview, saison?: CompanyReview } }
 * - UdInputFields … 申請書生成に必要な UD 補足項目（包括事業者コード等）
 * - review        … JCB / セゾンの審査結果（merchant_applications への配線元）
 * DB アクセスは行わない（API Route / コンポーネント双方から利用する）。
 */
import { z } from "zod";

/** 包括事業者コードの既定値（JCB の2層構造の親コード。UD=0160） */
export const DEFAULT_BULK_PROVIDER_CODE = "0160";

/** UD 追記フィールド（すべて任意。空文字は保存時に除去する） */
export interface UdInputFields {
  /** 包括事業者コード（JCB の2層構造の親コード。既定 0160） */
  bulk_provider_code?: string;
  /** 精算料率（%表記の文字列。例: "1.9"） */
  settlement_rate?: string;
  /** 業態コード（JCB 申請書の業態コード。例: 60207） */
  biz_cat_code?: string;
  /** セキュリティ対応状況（カード情報非保持・PCIDSS 等の申告内容） */
  security_status?: string;
  /** 振込先: 銀行名 */
  bank_name?: string;
  /** 振込先: 支店名 */
  bank_branch?: string;
  /** 振込先: 口座種別（ordinary=普通 / checking=当座） */
  account_type?: "ordinary" | "checking";
  /** 振込先: 口座番号 */
  account_number?: string;
  /** 振込先: 口座名義（カナ） */
  account_holder?: string;
}

/** UD 追記フィールドのキー一覧（parse / diff で使用） */
export const UD_INPUT_FIELD_KEYS: readonly (keyof UdInputFields)[] = [
  "bulk_provider_code",
  "settlement_rate",
  "biz_cat_code",
  "security_status",
  "bank_name",
  "bank_branch",
  "account_type",
  "account_number",
  "account_holder",
];

/** UD 追記フィールドの日本語ラベル（履歴・画面表示用） */
export const UD_INPUT_LABELS: Record<keyof UdInputFields, string> = {
  bulk_provider_code: "包括事業者コード",
  settlement_rate: "精算料率",
  biz_cat_code: "業態コード",
  security_status: "セキュリティ対応状況",
  bank_name: "振込先銀行名",
  bank_branch: "振込先支店名",
  account_type: "口座種別",
  account_number: "口座番号",
  account_holder: "口座名義",
};

/** 審査結果（NULL=結果待ち） */
export type ReviewResult = "approved" | "rejected";

/** カード会社1社分の審査記録（ud_input.review.jcb / .saison） */
export interface CompanyReview {
  /** 申請書の提出日（YYYY-MM-DD） */
  submitted_at?: string | null;
  /** 審査結果（未確定は null / 未設定） */
  result?: ReviewResult | null;
  /** 結果受領日（YYYY-MM-DD） */
  result_received_at?: string | null;
  /** NG 理由（result=rejected のとき） */
  ng_reason?: string | null;
  /** JCB: 加盟店番号（登録型 = 会員ID決済・継続課金用） */
  merchant_code_recurring?: string | null;
  /** JCB: 加盟店番号（都度型EC = トークン決済用） */
  merchant_code_ec?: string | null;
  /** セゾン: 加盟店番号（加盟店No. 通常7桁） */
  merchant_code?: string | null;
}

/** 審査対象のカード会社 */
export type ReviewCompany = "jcb" | "saison";

/** カード会社の日本語ラベル */
export const REVIEW_COMPANY_LABELS: Record<ReviewCompany, string> = {
  jcb: "JCB",
  saison: "セゾン",
};

/** 審査記録の集合（ud_input.review） */
export interface ApplicationReview {
  jcb?: CompanyReview;
  saison?: CompanyReview;
}

/**
 * UD 追記フィールドの形式検証スキーマ（保存時に適用）。
 * 桁数・数値形式の誤りは申請書生成で申請不能につながるため、入力時点で弾く。
 * すべて任意項目（入力された場合のみ形式を検証する）。
 */
export const udInputFieldsSchema = z.object({
  bulk_provider_code: z
    .string()
    .regex(/^\d{4}$/, "包括事業者コードは数字4桁です")
    .optional(),
  settlement_rate: z
    .string()
    .regex(/^\d{1,2}(\.\d{1,2})?$/, "精算料率は数値で入力してください（例: 1.9）")
    .refine((v) => Number.parseFloat(v) > 0 && Number.parseFloat(v) <= 10, {
      message: "精算料率は 0〜10% の範囲で入力してください",
    })
    .optional(),
  biz_cat_code: z
    .string()
    .regex(/^\d{5}$/, "業態コードは数字5桁です（例: 60207）")
    .optional(),
  security_status: z.string().max(200, "セキュリティ対応状況が長すぎます").optional(),
  bank_name: z.string().max(50, "銀行名が長すぎます").optional(),
  bank_branch: z.string().max(50, "支店名が長すぎます").optional(),
  account_type: z.enum(["ordinary", "checking"]).optional(),
  account_number: z
    .string()
    .regex(/^\d{4,8}$/, "口座番号は数字4〜8桁で入力してください")
    .optional(),
  account_holder: z.string().max(60, "口座名義が長すぎます").optional(),
});

/**
 * 生の ud_input（review 等の未知キーを含む）から UD 追記フィールドだけを検証する。
 * @returns 形式エラーの日本語メッセージ（問題なければ null）
 */
export function validateUdInputFields(
  raw: Record<string, unknown> | null | undefined
): string | null {
  const { fields } = parseUdInput(raw ?? null);
  const result = udInputFieldsSchema.safeParse(fields);
  return result.success ? null : (result.error.issues[0]?.message ?? "入力内容を確認してください");
}

/** 文字列以外・空文字を undefined に正規化する */
function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v : undefined;
}

/** unknown を CompanyReview へ安全に変換する（不正値は捨てる） */
function parseCompanyReview(raw: unknown): CompanyReview | undefined {
  if (raw == null || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const result = r.result === "approved" || r.result === "rejected" ? r.result : null;
  const review: CompanyReview = {
    submitted_at: asString(r.submitted_at) ?? null,
    result,
    result_received_at: asString(r.result_received_at) ?? null,
    ng_reason: asString(r.ng_reason) ?? null,
    merchant_code_recurring: asString(r.merchant_code_recurring) ?? null,
    merchant_code_ec: asString(r.merchant_code_ec) ?? null,
    merchant_code: asString(r.merchant_code) ?? null,
  };
  return review;
}

/** parse 結果（フィールドと審査記録を分離して返す） */
export interface ParsedUdInput {
  fields: UdInputFields;
  review: ApplicationReview;
}

/**
 * 生の ud_input jsonb を UdInputFields + ApplicationReview に分解する。
 * 未知キー・不正値は無視する（後方互換のため throw しない）。
 */
export function parseUdInput(raw: Record<string, unknown> | null | undefined): ParsedUdInput {
  const fields: UdInputFields = {};
  const review: ApplicationReview = {};
  if (raw && typeof raw === "object") {
    for (const key of UD_INPUT_FIELD_KEYS) {
      const v = raw[key];
      if (key === "account_type") {
        if (v === "ordinary" || v === "checking") fields.account_type = v;
      } else {
        const s = asString(v);
        if (s !== undefined) fields[key] = s;
      }
    }
    const rawReview = raw.review as Record<string, unknown> | undefined;
    if (rawReview && typeof rawReview === "object") {
      const jcb = parseCompanyReview(rawReview.jcb);
      const saison = parseCompanyReview(rawReview.saison);
      if (jcb) review.jcb = jcb;
      if (saison) review.saison = saison;
    }
  }
  return { fields, review };
}

/**
 * UdInputFields + ApplicationReview を ud_input jsonb（保存形）へ合成する。
 * 空文字のフィールドは除去する。
 */
export function serializeUdInput(
  fields: UdInputFields,
  review: ApplicationReview
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of UD_INPUT_FIELD_KEYS) {
    const v = fields[key];
    if (typeof v === "string" && v.trim() !== "") out[key] = v.trim();
  }
  if (review.jcb || review.saison) {
    out.review = {
      ...(review.jcb ? { jcb: review.jcb } : {}),
      ...(review.saison ? { saison: review.saison } : {}),
    };
  }
  return out;
}

/**
 * 審査記録を1社分だけ差し替えた ApplicationReview を返す（他社分は保持）。
 */
export function mergeCompanyReview(
  review: ApplicationReview,
  company: ReviewCompany,
  next: CompanyReview
): ApplicationReview {
  return { ...review, [company]: next };
}

/** 審査状況のサマリ（ボタン活性・変換可否の判定に使用） */
export interface ReviewSummary {
  jcbApproved: boolean;
  saisonApproved: boolean;
  anyApproved: boolean;
  allApproved: boolean;
  anyRejected: boolean;
}

/** ApplicationReview から承認状況サマリを算出する */
export function summarizeReview(review: ApplicationReview): ReviewSummary {
  const jcbApproved = review.jcb?.result === "approved";
  const saisonApproved = review.saison?.result === "approved";
  const anyRejected = review.jcb?.result === "rejected" || review.saison?.result === "rejected";
  return {
    jcbApproved,
    saisonApproved,
    anyApproved: jcbApproved || saisonApproved,
    allApproved: jcbApproved && saisonApproved,
    anyRejected,
  };
}

/**
 * UD 追記フィールドの変更点を日本語ラベルの配列で返す（履歴表示用）。
 * @returns 例: ["精算料率", "口座番号"]（変更なしは空配列）
 */
export function describeUdFieldChanges(
  before: UdInputFields,
  after: UdInputFields
): string[] {
  const changed: string[] = [];
  for (const key of UD_INPUT_FIELD_KEYS) {
    if ((before[key] ?? "") !== (after[key] ?? "")) changed.push(UD_INPUT_LABELS[key]);
  }
  return changed;
}
