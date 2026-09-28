/**
 * 決済セッション作成リクエストの検証（接続仕様書 v1.0 第6章）
 *
 * 形式の検証は zod、加盟店ごとの条件（届出ドメイン・販売可能期間・金額上限）は
 * validateSessionBusinessRules で行い、仕様書のエラーコードで返す。
 */
import { z } from "zod";
import { MerchantApiError } from "./errors";
import { addMonthsToDateString, isValidDateString, jstDateString } from "./time";

/** USEN の sum_price は数字最大7桁 */
export const USEN_MAX_AMOUNT = 9_999_999;
/** expires_in の既定値（秒） */
export const DEFAULT_EXPIRES_IN = 1800;
/** expires_in の下限（秒） */
export const MIN_EXPIRES_IN = 300;
/** USEN へ渡す戻り先URL等の長さ上限に合わせる */
const MAX_URL_LENGTH = 1024;

const itemSchema = z.object({
  name: z.string().min(1).max(120),
  unit_price: z.number().int().min(0).max(USEN_MAX_AMOUNT),
  quantity: z.number().int().min(1).max(1000),
});

/** POST /merchant/v1/checkout/sessions のリクエスト */
export const createSessionSchema = z.object({
  order_id: z.string().regex(/^[A-Za-z0-9-]{1,64}$/, "order_id は半角英数とハイフン、64文字以内です"),
  amount: z.number().int().min(1),
  event: z.object({
    event_id: z.string().min(1).max(64),
    event_name: z.string().min(1).max(120),
    event_date: z.string().refine(isValidDateString, "event_date は YYYY-MM-DD 形式の実在する日付です"),
  }),
  items: z.array(itemSchema).min(1).max(50),
  customer: z.object({
    email: z.string().email().max(254),
  }),
  return_url: z.string().url().max(MAX_URL_LENGTH),
  cancel_url: z.string().url().max(MAX_URL_LENGTH).optional(),
  expires_in: z.number().int().optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/** 検証に使う加盟店ごとの条件（merchant_api_credentials の列） */
export interface SessionPolicy {
  environment: "test" | "production";
  allowedDomains: string[];
  maxEventMonths: number;
  amountLimitPerPayment: number | null;
  maxExpiresIn: number;
}

/**
 * zod のエラーを invalid_request に変換する。
 */
export function parseCreateSessionInput(raw: unknown): CreateSessionInput {
  const parsed = createSessionSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new MerchantApiError("invalid_request", "リクエストの形式が正しくありません", { issues });
  }
  return parsed.data;
}

/**
 * URL のホストが届出ドメインに一致するか。
 * 完全一致のほか、届出値が "*.example.com" の場合はそのサブドメインを許可する。
 * test 環境に限り http://localhost（加盟店の開発端末）を許可する。
 */
export function isAllowedRedirectUrl(
  value: string,
  allowedDomains: string[],
  environment: "test" | "production"
): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  if (url.protocol === "http:") {
    return environment === "test" && (host === "localhost" || host === "127.0.0.1");
  }
  if (url.protocol !== "https:") return false;
  return allowedDomains.some((raw) => {
    const d = raw.trim().toLowerCase();
    if (d.startsWith("*.")) return host.endsWith(d.slice(1)) && host.length > d.length - 1;
    return host === d;
  });
}

/**
 * 加盟店ごとの条件で検証する。違反は仕様書のエラーコードで例外にする。
 *
 * @returns 採用する expires_in（秒）
 */
export function validateSessionBusinessRules(
  input: CreateSessionInput,
  policy: SessionPolicy,
  now: Date
): { expiresIn: number } {
  const itemsTotal = input.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);
  if (itemsTotal !== input.amount) {
    throw new MerchantApiError("amount_mismatch", "amount と items の合計が一致していません", {
      amount: input.amount,
      items_total: itemsTotal,
    });
  }

  const limit = Math.min(USEN_MAX_AMOUNT, policy.amountLimitPerPayment ?? USEN_MAX_AMOUNT);
  if (input.amount > limit) {
    throw new MerchantApiError("limit_exceeded", "決済金額が1件あたりの上限を超えています", {
      max_amount: limit,
    });
  }

  const today = jstDateString(now);
  const maxEventDate = addMonthsToDateString(today, policy.maxEventMonths);
  if (input.event.event_date < today || input.event.event_date > maxEventDate) {
    throw new MerchantApiError(
      "event_date_out_of_range",
      input.event.event_date < today ? "公演日が過去の日付です" : "公演日が販売可能期間を超えています",
      { min_event_date: today, max_event_date: maxEventDate }
    );
  }

  for (const [field, url] of [
    ["return_url", input.return_url],
    ["cancel_url", input.cancel_url],
  ] as const) {
    if (url !== undefined && !isAllowedRedirectUrl(url, policy.allowedDomains, policy.environment)) {
      throw new MerchantApiError("return_url_not_allowed", "届出のないドメインが指定されています", { field });
    }
  }

  const expiresIn = input.expires_in ?? DEFAULT_EXPIRES_IN;
  if (expiresIn < MIN_EXPIRES_IN || expiresIn > policy.maxExpiresIn) {
    throw new MerchantApiError("invalid_request", "expires_in が範囲外です", {
      min_expires_in: MIN_EXPIRES_IN,
      max_expires_in: policy.maxExpiresIn,
    });
  }
  return { expiresIn };
}
