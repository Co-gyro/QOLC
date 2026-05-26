/**
 * USEN PSP 3DセキュアEC決済API（導入ガイド 1.0.5 準拠）
 *
 * カード登録フロー:
 *   1. サーバーが決済画面表示API(checkout)のパラメータ + check_cd を生成
 *   2. ユーザーのブラウザが checkout URL へ POST（自動送信フォーム）
 *      → USENの決済入力画面でカード番号入力 + 3DS認証
 *   3. 会員登録成功時、init で指定した member_id にカードが紐付く
 *   4. USEN が ret_url にコールバック（jutyu_cd, user_card_corp, member_id, check_cd）
 *   5. サーバーが ret_url の check_cd を検証
 *
 * - 認証: check_cd = "HM" + HMAC-SHA256(指定フィールドを "," 連結, HMACキー)
 *   - checkout: フィールド = jutyu_cd, sum_price
 *   - ret_url : フィールド = jutyu_cd, user_card_corp, sum_price
 * - jutyu_cd の上位4桁がサイト/モールコード（管理画面で売上を上げる場合はサイトコード）
 */
import { generateCheckCode, type UsenKeyType } from "./hmac";
import { joinUrl } from "./usen-client";
import { UsenApiError } from "./errors";
import type { EcCheckoutParams } from "./types";

const ALGO = "sha256" as const;
const CHECKOUT_PATH = "checkout";

function ecBaseUrl(): string {
  const url = process.env.USEN_EC_API_BASE_URL;
  if (!url) throw new UsenApiError("USEN_EC_API_BASE_URL が設定されていません");
  return url;
}

export interface CheckoutForm {
  /** フォームの action（POST先 URL） */
  url: string;
  /** method（常に POST） */
  method: "POST";
  /** 自動送信フォームの hidden フィールド（check_cd を含む） */
  fields: Record<string, string>;
}

/**
 * 決済画面表示API(checkout)へ送信するフォーム定義を生成する。
 * フロントエンドはこの url/fields で自動送信フォームを描画し、ユーザーを USEN 決済画面へ遷移させる。
 *
 * @param params - 決済画面表示APIパラメータ
 * @param keyType - jutyu_cd に用いたコードの種別（サイトコード採番なら 'site'）
 */
export function buildCheckoutForm(
  params: EcCheckoutParams,
  keyType: UsenKeyType = "site"
): CheckoutForm {
  const check_cd = generateCheckCode(ALGO, keyType, [params.jutyu_cd, params.sum_price]);

  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    fields[k] = String(v);
  }
  fields.check_cd = check_cd;

  return {
    url: joinUrl(ecBaseUrl(), CHECKOUT_PATH),
    method: "POST",
    fields,
  };
}

/**
 * ret_url コールバックの check_cd を検証する。
 * 仕様: check_cd = "HM" + HMAC-SHA256(jutyu_cd, user_card_corp, sum_price)。
 *
 * @param ret - ret_url で受け取ったパラメータ
 * @param sumPrice - init 時に指定した sum_price（再計算に必要）
 * @param keyType - jutyu_cd に用いたコードの種別
 */
export function verifyReturnCheckCode(
  ret: { jutyu_cd: string; user_card_corp: string; check_cd: string },
  sumPrice: number,
  keyType: UsenKeyType = "site"
): boolean {
  const expected = generateCheckCode(ALGO, keyType, [
    ret.jutyu_cd,
    ret.user_card_corp,
    sumPrice,
  ]);
  return timingSafeEqualStr(expected, ret.check_cd);
}

/**
 * ret_url の結果が「会員登録成功」かを判定する。
 * 仕様上、会員登録成功時のみ member_id に値が入る（失敗・未登録はブランク）。
 */
export function isRegistrationSuccess(ret: { member_id?: string }): boolean {
  return !!ret.member_id && ret.member_id.trim().length > 0;
}

/** 長さ非依存ではないが定数時間比較に近づける簡易比較 */
function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
