/**
 * 加盟店API のレスポンス整形（接続仕様書 第6章・第8章）
 */
import { toJstIso, toJstIsoOrNull } from "./time";
import type { MerchantPaymentRow } from "./types";

/** 決済照会のレスポンス（第8章） */
export interface PaymentResource {
  payment_id: string;
  order_id: string;
  status: MerchantPaymentRow["status"];
  amount: number;
  currency: string;
  event: { event_id: string; event_date: string };
  card: { brand: string | null; last4: string | null } | null;
  created_at: string;
  captured_at: string | null;
  refunded_at: string | null;
  failure: { code: string; message: string } | null;
}

/** セッション作成のレスポンス（第6章） */
export interface SessionResource {
  session_id: string;
  payment_id: string;
  order_id: string;
  status: MerchantPaymentRow["status"];
  redirect_url: string;
  expires_at: string;
}

/** 決済画面のURL */
export function checkoutPageUrl(appUrl: string, sessionId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/checkout/${sessionId}`;
}

/**
 * 決済照会の形に整える。
 */
export function toPaymentResource(row: MerchantPaymentRow): PaymentResource {
  const hasCard = row.card_brand !== null || row.card_last4 !== null;
  return {
    payment_id: row.payment_id,
    order_id: row.order_id,
    status: row.status,
    amount: Number(row.amount),
    currency: row.currency,
    event: { event_id: row.event_id, event_date: row.event_date },
    card: hasCard ? { brand: row.card_brand, last4: row.card_last4 } : null,
    created_at: toJstIso(new Date(row.created_at)),
    captured_at: toJstIsoOrNull(row.captured_at),
    refunded_at: toJstIsoOrNull(row.refunded_at),
    failure:
      row.status === "failed"
        ? { code: row.failure_code ?? "processing_error", message: row.failure_message ?? failureMessage("processing_error") }
        : null,
  };
}

/**
 * セッション作成の形に整える。
 */
export function toSessionResource(row: MerchantPaymentRow, appUrl: string): SessionResource {
  return {
    session_id: row.session_id,
    payment_id: row.payment_id,
    order_id: row.order_id,
    status: row.status,
    redirect_url: checkoutPageUrl(appUrl, row.session_id),
    expires_at: toJstIso(new Date(row.expires_at)),
  };
}

/** 加盟店へ返す失敗理由コード */
export type FailureCode =
  | "card_declined"
  | "expired_card"
  | "three_ds_failed"
  | "processing_error";

/**
 * 失敗理由の説明（加盟店の開発者向け。購入者へそのまま表示しない前提）。
 */
export function failureMessage(code: FailureCode | string): string {
  switch (code) {
    case "card_declined":
      return "カード会社によりお取り扱いができませんでした";
    case "expired_card":
      return "カードの有効期限が切れているか、入力に誤りがあります";
    case "three_ds_failed":
      return "本人認証（3Dセキュア）が完了しませんでした";
    default:
      return "決済処理を完了できませんでした";
  }
}

/**
 * USEN の処理結果詳細コード（/i/pay・トークン式EC決済API仕様書 8.5）を失敗理由コードに変換する。
 */
export function failureCodeFromUsen(code: string | null | undefined): FailureCode {
  switch (code) {
    case "02":
    case "06":
    case "07":
      return "card_declined";
    case "03":
      return "expired_card";
    case "09":
      return "three_ds_failed";
    default:
      return "processing_error";
  }
}
