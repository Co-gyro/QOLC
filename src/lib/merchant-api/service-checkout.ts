/**
 * 当社ホストの決済画面（/checkout/{session_id}）の業務ロジック
 *
 * USEN トークン式EC決済の流れ（トークン式EC決済API仕様書 6章）:
 *   1. 画面表示       … created → pending
 *   2. /token/init    … SDK が呼ぶ。受注コードを1回だけ使うロックを取り、USEN /i/token/init（即時売上）
 *   3. 3Dセキュア      … SDK と USEN の間で完結
 *   4. /pay           … OnPaymentStart の check_cd で USEN /i/pay。取引照会で確定させる
 *   5. 加盟店の return_url へ署名付きで戻す
 *
 * カード番号・セキュリティコードは USEN の iframe に入力され、当社サーバにも届かない。
 * 購入者のブラウザからの申告（エラー種別等）は、状態を「進めない」方向にしか使わない。
 */
import type { MerchantApiDeps } from "./deps";
import { buildReturnUrl } from "./signature";
import { failureCodeFromUsen } from "./serialize";
import { markFailed, reconcile, expireIfDue, transition } from "./service-state";
import { usenDate, usenDateTime } from "./time";
import type { UsenTokenInitResponse } from "./usen-gateway";
import type { MerchantPaymentRow, PaymentItem } from "./types";

/** 決済画面の業務エラー（購入者向け文言を持つ） */
export class CheckoutError extends Error {
  readonly httpStatus: number;
  /**
   * @param httpStatus - HTTPステータス
   * @param message - 購入者に表示してよい文言
   */
  constructor(httpStatus: number, message: string) {
    super(message);
    this.name = "CheckoutError";
    this.httpStatus = httpStatus;
  }
}

/** 決済画面の表示内容 */
export interface CheckoutView {
  sessionId: string;
  status: MerchantPaymentRow["status"];
  merchantName: string;
  eventName: string;
  eventDate: string;
  items: PaymentItem[];
  amount: number;
  expiresAt: string;
  environment: MerchantPaymentRow["environment"];
  /** 決済可能なときのみ */
  usen: { jutyuCd: string; mallCd: string; tokenJsUrl: string; sdkApiBaseUrl: string | null } | null;
  /** 決済できない状態のときの戻り先（署名付き） */
  returnUrl: string | null;
}

/** 決済可能な状態か（未完了・期限内・/i/pay 未要求） */
function isPayable(row: MerchantPaymentRow, now: Date): boolean {
  return row.status === "pending" && !row.usen_pay_requested_at && new Date(row.expires_at) > now;
}

/**
 * セッションを取得する（存在しなければ 404）。期限切れはここで確定させる。
 */
async function loadSession(deps: MerchantApiDeps, sessionId: string): Promise<MerchantPaymentRow> {
  const row = await deps.store.findPaymentBySessionId(sessionId);
  if (!row) throw new CheckoutError(404, "お支払い画面が見つかりません。購入手続きを最初からやり直してください。");
  return expireIfDue(deps, row);
}

/**
 * 加盟店へ戻すURL（戻りパラメータ・署名付き）。中断は cancel_url（無ければ return_url）へ。
 */
export async function returnUrlFor(deps: MerchantApiDeps, row: MerchantPaymentRow): Promise<string> {
  const credential = await deps.store.getCredential(row.credential_id);
  if (!credential) throw new Error("[merchant-api] 資格情報が見つかりません");
  const [secret] = deps.secretsOf(credential);
  const status = row.status === "created" ? "pending" : row.status;
  const base = row.status === "cancelled" ? row.cancel_url ?? row.return_url : row.return_url;
  return buildReturnUrl(base, secret, {
    orderId: row.order_id,
    paymentId: row.payment_id,
    status,
    timestamp: Math.floor(deps.now().getTime() / 1000),
  });
}

/**
 * 決済画面を開く。初回表示で created → pending にする（第4章: 決済画面で処理中）。
 */
export async function openCheckout(deps: MerchantApiDeps, sessionId: string): Promise<CheckoutView> {
  let row = await loadSession(deps, sessionId);
  if (row.status === "created") {
    row = (await transition(deps, row, "pending")) ?? (await loadSession(deps, sessionId));
  }
  const merchant = await deps.store.getMerchant(row.merchant_id);
  const now = deps.now();
  const payable = isPayable(row, now) && !!row.usen_jutyu_cd;
  let usen: CheckoutView["usen"] = null;
  if (payable && row.usen_jutyu_cd) {
    const profile = deps.resolveProfile(row.environment, merchant?.mall_code ?? null);
    usen = {
      jutyuCd: row.usen_jutyu_cd,
      mallCd: profile.mallCd,
      tokenJsUrl: profile.tokenJsUrl,
      sdkApiBaseUrl: profile.sdkApiBaseUrl,
    };
  }
  return {
    sessionId: row.session_id,
    status: row.status,
    merchantName: merchant?.name ?? "",
    eventName: row.event_name,
    eventDate: row.event_date,
    items: row.items,
    amount: Number(row.amount),
    expiresAt: row.expires_at,
    environment: row.environment,
    usen,
    // 決済可能、または /i/pay の結果待ち（画面側で処理中表示）のときは戻り先を出さない
    returnUrl: payable || (!!row.usen_pay_requested_at && row.status === "pending") ? null : await returnUrlFor(deps, row),
  };
}

/**
 * USEN へ渡す会員ID（英数48桁以内）。決済ごとに一意で、購入者をまたいで使い回さない。
 */
export function usenMemberIdFor(row: MerchantPaymentRow): string {
  return "U" + row.id.replace(/-/g, "");
}

/** SDK から /token/init に届く値（トークン式EC決済API仕様書 10.1.7） */
export interface CheckoutTokenInitBody {
  jutyu_cd: string;
  token: string;
  card_limit_yyyy: string;
  card_limit_mm: string;
  cardholder_name: string;
}

/**
 * 受注コードを新しくして、再入力を受け付けられる状態に戻す。
 * /i/token/init が失敗した・3Dセキュアが通信エラーで中断した場合に使う（売上は立っていない）。
 */
async function rotateAttempt(deps: MerchantApiDeps, row: MerchantPaymentRow): Promise<MerchantPaymentRow | null> {
  const merchant = await deps.store.getMerchant(row.merchant_id);
  const profile = deps.resolveProfile(row.environment, merchant?.mall_code ?? null);
  const next = await deps.store.nextJutyuCd(profile.mallCd);
  const updated = await deps.store.updatePayment(
    row.id,
    { usen_jutyu_cd: next, usen_attempted_at: null },
    { statusIn: ["pending"], jutyuCd: row.usen_jutyu_cd ?? undefined, payRequestedIsNull: true }
  );
  if (updated) {
    await deps.store.audit({
      action: "merchant_attempt_rotate",
      merchantPaymentId: row.id,
      request: { previous_jutyu_cd: row.usen_jutyu_cd, next_jutyu_cd: next },
    });
  }
  return updated;
}

/**
 * SDK からの決済初期化。USEN のレスポンスをそのまま SDK へ返す（仕様 6章 12.）。
 */
export async function checkoutTokenInit(
  deps: MerchantApiDeps,
  sessionId: string,
  body: CheckoutTokenInitBody,
  ipAddress: string | null
): Promise<UsenTokenInitResponse> {
  const row = await loadSession(deps, sessionId);
  const now = deps.now();
  if (!isPayable(row, now) || row.usen_jutyu_cd !== body.jutyu_cd) {
    throw new CheckoutError(409, "このお支払い画面は使用できません。画面を再読み込みしてください。");
  }
  const locked = await deps.store.updatePayment(
    row.id,
    { usen_attempted_at: now.toISOString() },
    { statusIn: ["pending"], jutyuCd: body.jutyu_cd, attemptedIsNull: true, payRequestedIsNull: true }
  );
  if (!locked) throw new CheckoutError(409, "お支払いの処理中です。画面を再読み込みしてください。");

  const merchant = await deps.store.getMerchant(row.merchant_id);
  const profile = deps.resolveProfile(row.environment, merchant?.mall_code ?? null);
  const request = {
    jutyu_cd: body.jutyu_cd,
    sum_price: Number(row.amount),
    jutyu_day: usenDate(now),
    expiration_date: usenDateTime(new Date(row.expires_at)),
    option: "capture",
  };
  let res: UsenTokenInitResponse;
  try {
    res = await deps.usen.tokenInit(profile, {
      jutyuCd: body.jutyu_cd,
      amount: Number(row.amount),
      jutyuDay: request.jutyu_day,
      expirationDate: request.expiration_date,
      token: body.token,
      cardLimitYyyy: body.card_limit_yyyy,
      cardLimitMm: body.card_limit_mm,
      cardholderName: body.cardholder_name,
      email: row.customer_email,
      memberId: usenMemberIdFor(row),
    });
  } catch (e) {
    await deps.store.audit({
      action: "merchant_token_init",
      merchantPaymentId: row.id,
      request,
      response: { error: e instanceof Error ? e.message : String(e) },
      ipAddress,
    });
    await rotateAttempt(deps, locked);
    throw new CheckoutError(502, "通信エラーが発生しました。もう一度お試しください。");
  }
  await deps.store.audit({ action: "merchant_token_init", merchantPaymentId: row.id, request, response: res, ipAddress });
  if (res.result !== "ok") await rotateAttempt(deps, locked);
  return res;
}

/** /pay・/cancel・/abort の結果 */
export interface CheckoutOutcome {
  /** retry: 同じ画面で入力し直せる / redirect: 加盟店へ戻す */
  outcome: "retry" | "redirect";
  jutyuCd?: string;
  redirectUrl?: string;
  status: MerchantPaymentRow["status"];
}

/** 加盟店へ戻す結果を作る */
async function redirectOutcome(deps: MerchantApiDeps, row: MerchantPaymentRow): Promise<CheckoutOutcome> {
  return { outcome: "redirect", redirectUrl: await returnUrlFor(deps, row), status: row.status };
}

/**
 * 3Dセキュア完了後の決済（OnPaymentStart から呼ぶ）。
 */
export async function checkoutPay(
  deps: MerchantApiDeps,
  sessionId: string,
  body: { jutyu_cd: string; token: string; check_cd: string },
  ipAddress: string | null
): Promise<CheckoutOutcome> {
  const row = await loadSession(deps, sessionId);
  const now = deps.now();
  const locked = await deps.store.updatePayment(
    row.id,
    { usen_pay_requested_at: now.toISOString() },
    { statusIn: ["pending"], jutyuCd: body.jutyu_cd, attemptedIsNotNull: true, payRequestedIsNull: true }
  );
  if (!locked) {
    // 二重送信・受注コード違い・既に確定済み。現在の状態で戻す
    const current = row.usen_pay_requested_at && row.status === "pending" ? await reconcile(deps, row) : row;
    return redirectOutcome(deps, current);
  }

  const merchant = await deps.store.getMerchant(row.merchant_id);
  const profile = deps.resolveProfile(row.environment, merchant?.mall_code ?? null);
  let payCode: string | null = null;
  let payResult: string | null = null;
  let brand: string | null = null;
  try {
    const res = await deps.usen.pay(profile, { jutyuCd: body.jutyu_cd, token: body.token, checkCd: body.check_cd });
    payCode = res.code;
    payResult = res.result;
    brand = res.brand ?? null;
    await deps.store.audit({
      action: "merchant_pay",
      merchantPaymentId: row.id,
      request: { jutyu_cd: body.jutyu_cd },
      response: res,
      ipAddress,
    });
  } catch (e) {
    await deps.store.audit({
      action: "merchant_pay",
      merchantPaymentId: row.id,
      request: { jutyu_cd: body.jutyu_cd },
      response: { error: e instanceof Error ? e.message : String(e) },
      ipAddress,
    });
  }

  // 売上の成否は /i/pay の応答ではなく取引照会で確定させる
  let current = locked;
  try {
    current = await reconcile(deps, locked, { brand });
  } catch (e) {
    await deps.store.audit({
      action: "merchant_reconcile_error",
      merchantPaymentId: row.id,
      response: { error: e instanceof Error ? e.message : String(e) },
    });
  }
  if (current.status === "pending" && payResult === "ng") {
    current = (await markFailed(deps, current, failureCodeFromUsen(payCode))) ?? current;
  }
  return redirectOutcome(deps, current);
}

/**
 * 購入者による中断。/i/pay を要求した後は受け付けない（売上が立っている可能性があるため）。
 */
export async function checkoutCancel(deps: MerchantApiDeps, sessionId: string): Promise<CheckoutOutcome> {
  const row = await loadSession(deps, sessionId);
  if (row.status === "created" || row.status === "pending") {
    const done = await transition(deps, row, "cancelled", {}, { payRequestedIsNull: true });
    if (done) return redirectOutcome(deps, done);
    const current = await deps.store.findPaymentBySessionId(sessionId);
    return redirectOutcome(deps, current ?? row);
  }
  return redirectOutcome(deps, row);
}

/** SDK の OnPaymentError の種別（トークン式EC決済API仕様書 10.1.5） */
export type PaymentErrorType = "NG_3DS_BRW_INIT" | "NG_3DS_BRW_AUTH" | "NETWORK" | "UNEXPECTED" | "INIT_NG";

/**
 * 決済画面でのエラー（OnPaymentError）。本人認証の失敗は failed として確定させ、
 * それ以外（通信エラー等）は受注コードを新しくして入力し直してもらう。
 */
export async function checkoutAbort(
  deps: MerchantApiDeps,
  sessionId: string,
  body: { jutyu_cd: string; error_type: PaymentErrorType; detail?: string }
): Promise<CheckoutOutcome> {
  const row = await loadSession(deps, sessionId);
  await deps.store.audit({
    action: "merchant_payment_error",
    merchantPaymentId: row.id,
    request: { jutyu_cd: body.jutyu_cd, error_type: body.error_type },
    response: { detail: body.detail ?? null },
  });
  if (row.status !== "pending") return redirectOutcome(deps, row);
  if (row.usen_pay_requested_at) {
    // /i/pay 側の処理が結果を確定させる。ここでは状態を動かさない
    return redirectOutcome(deps, await reconcile(deps, row));
  }
  const sameAttempt = row.usen_jutyu_cd === body.jutyu_cd && !!row.usen_attempted_at;
  if (sameAttempt && body.error_type === "NG_3DS_BRW_AUTH") {
    const failed = await markFailed(deps, row, "three_ds_failed", {
      jutyuCd: body.jutyu_cd,
      attemptedIsNotNull: true,
      payRequestedIsNull: true,
    });
    return redirectOutcome(deps, failed ?? (await loadSession(deps, sessionId)));
  }
  const rotated = sameAttempt ? await rotateAttempt(deps, row) : row;
  const current = rotated ?? (await loadSession(deps, sessionId));
  if (current.status !== "pending") return redirectOutcome(deps, current);
  return { outcome: "retry", jutyuCd: current.usen_jutyu_cd ?? undefined, status: current.status };
}
