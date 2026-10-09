import type { SupabaseClient } from "@supabase/supabase-js";
import type { PayResponse, TokenInitParams } from "@/lib/payment/token-ec-api";
import type { MemberApiResult } from "@/lib/payment/types";
import { parseXmlResponse } from "@/lib/payment/usen-client";
import { toExpireYm } from "@/lib/payment/card-expiry";
import { findCustomerByToken, type ProdCustomer } from "./customers";
import { getUdpayMerchant, type UdpayMerchant } from "./merchants";
import { isRegistrationToken, udpayMemberId } from "./identifiers";

/**
 * UD Payment（本番）のカード登録（顧客がカード登録リンクから行う）。
 *
 * USEN トークン式EC決済API: SDK がカードをトークン化 → /i/token/init（member_id 指定で会員登録・
 * 1円の与信のみで売上計上しない＝自動失効）→ 3DS → /i/pay。成功したら会員IDを顧客に保存し、
 * 会員情報取得（/member/get）でブランド・下4桁・有効期限を保存する。
 * モールコードは環境変数ではなく加盟店マスタ（merchants.mall_code）から取り、受注コードの接頭辞にする。
 */

/** カード登録時の与信額（1円・売上計上しないため自動失効し、請求されない） */
export const REGISTER_SUM_PRICE = 1;

/** 外部依存（テストで差し替える） */
export interface CardRegistrationDeps {
  client: SupabaseClient;
  nextJutyuCd: (mallCode: string) => Promise<string>;
  tokenInit: (params: TokenInitParams) => Promise<Record<string, unknown>>;
  pay: (args: { jutyu_cd: string; token: string; check_cd: string }) => Promise<PayResponse>;
  memberGet: (args: { memberId: string }) => Promise<MemberApiResult>;
  audit: (entry: { action: string; request: unknown; response: unknown }) => Promise<unknown>;
  formatUsenDate: () => string;
}

/** 登録リンクから引いた顧客と加盟店 */
export interface RegistrationContext {
  customer: ProdCustomer;
  merchant: UdpayMerchant & { mallCode: string };
  memberId: string;
}

/** 登録リンクが使えない理由 */
export type ContextError = "invalid_link" | "merchant_not_ready";

/** 登録リンクのトークンから、顧客・加盟店・会員IDを引く */
export async function loadRegistrationContext(
  client: SupabaseClient,
  token: string,
): Promise<{ ok: true; ctx: RegistrationContext } | { ok: false; error: ContextError }> {
  if (!isRegistrationToken(token)) return { ok: false, error: "invalid_link" };
  const customer = await findCustomerByToken(client, token);
  if (!customer) return { ok: false, error: "invalid_link" };
  const merchant = await getUdpayMerchant(client, customer.merchantId);
  if (!merchant?.mallCode) return { ok: false, error: "merchant_not_ready" };
  return {
    ok: true,
    ctx: { customer, merchant: { ...merchant, mallCode: merchant.mallCode }, memberId: udpayMemberId(customer.id) },
  };
}

/** 受注コードがこの加盟店のモールコードで採番されたものか（他加盟店の受注コードの持ち込みを防ぐ） */
export function belongsToMall(jutyuCd: string, mallCode: string): boolean {
  return new RegExp(`^${mallCode}-\\d{7}$`).test(jutyuCd);
}

/** 3DS に使うメールアドレス（顧客の宛先 To の先頭） */
export function threeDsEmail(customer: ProdCustomer): string | null {
  return customer.contacts.find((c) => c.kind === "to")?.email ?? null;
}

/** /i/token/init のリクエスト本体（SDK から届く値） */
export interface TokenInitBody {
  jutyu_cd: string;
  token: string;
  card_limit_yyyy: string;
  card_limit_mm: string;
  cardholder_name: string;
  pay_method?: string | null;
}

/**
 * 決済初期化（SDK の startPaymentProcess から呼ばれる）。USEN のレスポンスをそのまま返す。
 * 既にカード登録済みの顧客は option=member-modify でカードを上書きする（カード変更）。
 */
export async function initCardToken(
  deps: CardRegistrationDeps,
  ctx: RegistrationContext,
  body: TokenInitBody,
): Promise<{ ok: true; response: Record<string, unknown> } | { ok: false; error: string }> {
  if (!belongsToMall(body.jutyu_cd, ctx.merchant.mallCode)) return { ok: false, error: "受注コードが不正です" };
  const email = threeDsEmail(ctx.customer);
  if (!email) return { ok: false, error: "宛先メールアドレスが未登録です" };
  const params: TokenInitParams = {
    jutyu_cd: body.jutyu_cd,
    sum_price: REGISTER_SUM_PRICE,
    jutyu_day: deps.formatUsenDate(),
    token: body.token,
    card_limit_yyyy: body.card_limit_yyyy,
    card_limit_mm: body.card_limit_mm,
    cardholder_name: body.cardholder_name,
    member_id: ctx.memberId,
    option: ctx.customer.usenMemberId ? "member-modify" : undefined,
    pay_method: body.pay_method ?? undefined,
    three_ds_cardholder_info: { email },
  };
  const response = await deps.tokenInit(params);
  await deps.audit({
    action: "udpay_card_token_init",
    request: { jutyu_cd: body.jutyu_cd, sum_price: REGISTER_SUM_PRICE, member_id: ctx.memberId, option: params.option },
    response,
  });
  return { ok: true, response };
}

/** 会員情報取得の結果から、下4桁・有効期限を取り出す（member_data は入れ子のため再解析する） */
export function extractMemberCard(res: MemberApiResult): { last4: string | null; expireYm: string | null; brand: string | null } {
  const raw = res as Record<string, string | undefined>;
  const nested = raw.member_data ? parseXmlResponse(`<response>${raw.member_data}</response>`) : {};
  const pick = (k: string) => nested[k] ?? raw[k];
  const cardNum = pick("card_num");
  const last4 = cardNum && /\d{4}$/.test(cardNum) ? cardNum.slice(-4) : null;
  return { last4, expireYm: toExpireYm(pick("expire_yyyy"), pick("expire_mm")), brand: pick("ucorp") ?? null };
}

/** カード登録の完了結果 */
export type CompleteResult =
  | { ok: true; brand: string | null; last4: string | null; expireYm: string | null }
  | { ok: false; error: string; retryJutyuCd: string };

/**
 * 決済（3DS 後の OnPaymentStart から呼ばれる）。成功なら会員IDとカード情報を顧客に保存する。
 * 失敗時は入力し直せるよう、新しい受注コードを返す（同じ受注コードは再利用できない）。
 */
export async function completeCardRegistration(
  deps: CardRegistrationDeps,
  ctx: RegistrationContext,
  body: { jutyu_cd: string; token: string; check_cd: string },
): Promise<CompleteResult> {
  if (!belongsToMall(body.jutyu_cd, ctx.merchant.mallCode)) {
    return { ok: false, error: "受注コードが不正です", retryJutyuCd: await deps.nextJutyuCd(ctx.merchant.mallCode) };
  }
  const res = await deps.pay(body);
  await deps.audit({ action: "udpay_card_pay", request: { jutyu_cd: body.jutyu_cd, member_id: ctx.memberId }, response: res });
  if (res.result !== "ok") {
    return {
      ok: false,
      error: `カードを登録できませんでした（code=${res.code}）`,
      retryJutyuCd: await deps.nextJutyuCd(ctx.merchant.mallCode),
    };
  }
  const memberId = res.member_id || ctx.memberId;
  // 下4桁・有効期限は取得できなくても登録自体は成功扱い（後から一括取得できる）
  let card: ReturnType<typeof extractMemberCard> = { last4: null, expireYm: null, brand: null };
  try {
    const info = await deps.memberGet({ memberId });
    if (info.result === "ok") card = extractMemberCard(info);
  } catch {
    // 取得失敗は無視
  }
  const now = new Date().toISOString();
  const brand = res.brand ?? card.brand;
  const { error } = await deps.client
    .from("udpay_customers")
    .update({
      usen_member_id: memberId,
      card_brand: brand,
      card_last4: card.last4,
      card_expire_ym: card.expireYm,
      card_registered_at: now,
      card_checked_at: card.expireYm ? now : null,
    })
    .eq("id", ctx.customer.id);
  if (error) throw new Error(`カード情報の保存に失敗: ${error.message}`);
  return { ok: true, brand, last4: card.last4, expireYm: card.expireYm };
}
