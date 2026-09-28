/**
 * 加盟店API の型定義（migration 036 のテーブルに対応）
 */

/** 接続環境 */
export type MerchantApiEnvironment = "test" | "production";

/** 決済の状態（接続仕様書 第4章） */
export type MerchantPaymentStatus =
  | "created"
  | "pending"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired"
  | "refunded";

/** 未完了（購入者の操作・USENの結果待ち）の状態 */
export const OPEN_STATUSES: MerchantPaymentStatus[] = ["created", "pending"];

/** merchant_api_credentials の行 */
export interface CredentialRow {
  id: string;
  merchant_id: string;
  environment: MerchantApiEnvironment;
  api_merchant_id: string;
  secret_enc: string;
  secret_last4: string;
  previous_secret_enc: string | null;
  previous_secret_expires_at: string | null;
  allowed_domains: string[];
  webhook_url: string | null;
  max_event_months: number;
  amount_limit_per_payment: number | null;
  max_expires_in: number;
  suspended_at: string | null;
  revoked_at: string | null;
}

/** 決済に紐づく加盟店情報 */
export interface MerchantInfo {
  id: string;
  name: string;
  mall_code: string | null;
}

/** 決済画面・通知で使う明細行 */
export interface PaymentItem {
  name: string;
  unit_price: number;
  quantity: number;
}

/** merchant_payments の行 */
export interface MerchantPaymentRow {
  id: string;
  merchant_id: string;
  credential_id: string;
  environment: MerchantApiEnvironment;
  order_id: string;
  payment_id: string;
  session_id: string;
  status: MerchantPaymentStatus;
  amount: number;
  currency: string;
  event_id: string;
  event_name: string;
  event_date: string;
  event_settled_at: string | null;
  event_cancelled_at: string | null;
  items: PaymentItem[];
  customer_email: string;
  return_url: string;
  cancel_url: string | null;
  usen_jutyu_cd: string | null;
  usen_attempted_at: string | null;
  usen_pay_requested_at: string | null;
  usen_status: string | null;
  usen_synced_at: string | null;
  card_brand: string | null;
  card_last4: string | null;
  expires_at: string;
  captured_at: string | null;
  refunded_at: string | null;
  closed_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
}

/** 新規作成時に渡す列 */
export type NewMerchantPayment = Omit<
  MerchantPaymentRow,
  | "id"
  | "status"
  | "currency"
  | "usen_attempted_at"
  | "usen_pay_requested_at"
  | "usen_status"
  | "usen_synced_at"
  | "card_brand"
  | "card_last4"
  | "captured_at"
  | "refunded_at"
  | "closed_at"
  | "failure_code"
  | "failure_message"
  | "created_at"
  | "updated_at"
>;

/** 条件付き更新の前提条件（先取りロック） */
export interface UpdateGuard {
  statusIn?: MerchantPaymentStatus[];
  jutyuCd?: string;
  attemptedIsNull?: boolean;
  attemptedIsNotNull?: boolean;
  payRequestedIsNull?: boolean;
}

/** 通知の種別（接続仕様書 第10章） */
export type WebhookEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.expired"
  | "payment.refunded";

/** merchant_webhook_deliveries の行 */
export interface WebhookDeliveryRow {
  id: string;
  merchant_payment_id: string;
  event_type: WebhookEventType;
  occurred_at: string;
  url: string;
  attempt: number;
  status_code: number | null;
  error_message: string | null;
  delivered_at: string | null;
  next_retry_at: string | null;
}

/** 取引一覧の検索条件 */
export interface PaymentListFilter {
  merchantId: string;
  environment: MerchantApiEnvironment;
  from: string;
  to: string;
  statuses?: MerchantPaymentStatus[];
  eventId?: string;
  limit: number;
  cursor?: { createdAt: string; id: string };
}
