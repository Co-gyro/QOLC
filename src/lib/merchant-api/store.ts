/**
 * 加盟店API の永続化インターフェース
 *
 * 業務ロジック（service-*.ts）はこのインターフェースだけに依存させ、
 * 本番は Supabase 実装（supabase-store.ts）、テストはメモリ実装を差し込む。
 */
import type {
  CredentialRow,
  MerchantInfo,
  MerchantPaymentRow,
  NewMerchantPayment,
  PaymentListFilter,
  UpdateGuard,
  WebhookDeliveryRow,
  WebhookEventType,
} from "./types";

/** 監査ログの1件 */
export interface MerchantAuditEntry {
  action: string;
  merchantPaymentId: string | null;
  request?: unknown;
  response?: unknown;
  ipAddress?: string | null;
}

/** 加盟店API の永続化操作 */
export interface MerchantApiStore {
  /** X-UD-Merchant-Id から資格情報を引く（削除済みは除く） */
  findCredentialByApiId(apiMerchantId: string): Promise<CredentialRow | null>;
  /** 資格情報をIDで引く */
  getCredential(id: string): Promise<CredentialRow | null>;
  /** 加盟店の表示名・モールコード */
  getMerchant(id: string): Promise<MerchantInfo | null>;
  /** 受注コードを採番する（[モールコード]-[7桁]） */
  nextJutyuCd(mallCd: string): Promise<string>;

  /** 注文IDで引く（冪等判定） */
  findPaymentByOrder(merchantId: string, environment: string, orderId: string): Promise<MerchantPaymentRow | null>;
  /** 内部ID（merchant_payments.id）で引く */
  findPaymentById(id: string): Promise<MerchantPaymentRow | null>;
  findPaymentByPaymentId(paymentId: string): Promise<MerchantPaymentRow | null>;
  findPaymentBySessionId(sessionId: string): Promise<MerchantPaymentRow | null>;
  /** 作成する。注文IDの一意制約に当たった場合は "conflict" */
  insertPayment(row: NewMerchantPayment): Promise<MerchantPaymentRow | "conflict">;
  /**
   * 前提条件を満たす場合だけ更新する（先取りロック）。満たさなければ null。
   */
  updatePayment(
    id: string,
    patch: Partial<MerchantPaymentRow>,
    guard?: UpdateGuard
  ): Promise<MerchantPaymentRow | null>;
  /** 取引一覧（created_at 昇順・id 昇順） */
  listPayments(filter: PaymentListFilter): Promise<MerchantPaymentRow[]>;
  /** 期限を過ぎた未完了の決済 */
  listExpiredOpenPayments(before: string, limit: number): Promise<MerchantPaymentRow[]>;

  /** 通知を積む（同一決済・同一種別は1本。既にあれば何もしない） */
  enqueueWebhook(args: {
    merchantPaymentId: string;
    eventType: WebhookEventType;
    occurredAt: string;
    url: string;
  }): Promise<void>;
  /** 送信期限が来た未達の通知 */
  listDueWebhooks(now: string, limit: number): Promise<WebhookDeliveryRow[]>;
  /** 通知の配送結果を記録する */
  updateWebhook(id: string, patch: Partial<WebhookDeliveryRow>): Promise<void>;

  /** 監査ログ（決済操作はすべて記録する） */
  audit(entry: MerchantAuditEntry): Promise<void>;
}
