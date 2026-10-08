/**
 * 加盟店API テスト用のメモリ実装と既定値
 */
import { randomUUID, randomBytes } from "node:crypto";
import type { MerchantApiDeps, UsenPort } from "@/lib/merchant-api/deps";
import type { MerchantApiStore, MerchantAuditEntry } from "@/lib/merchant-api/store";
import type { UsenProfile } from "@/lib/merchant-api/usen-profile";
import type {
  CredentialRow,
  MerchantInfo,
  MerchantPaymentRow,
  NewMerchantPayment,
  UpdateGuard,
  WebhookDeliveryRow,
} from "@/lib/merchant-api/types";
import { newPaymentId, newSessionId } from "@/lib/merchant-api/ids";

export const SECRET = "sk_test_secret";
export const MERCHANT_ID = "08f967cb-c6ca-4a65-a435-f173fb89a5fd";

/** 資格情報の既定値 */
export function makeCredential(overrides: Partial<CredentialRow> = {}): CredentialRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    merchant_id: MERCHANT_ID,
    environment: "test",
    api_merchant_id: "mch_test_ABCDEFGHJKMNPQRS",
    secret_enc: "enc",
    secret_last4: "cret",
    previous_secret_enc: null,
    previous_secret_expires_at: null,
    allowed_domains: ["ainylive.com"],
    webhook_url: "https://ainylive.com/api/ud/webhook",
    max_event_months: 3,
    amount_limit_per_payment: null,
    max_expires_in: 3600,
    suspended_at: null,
    revoked_at: null,
    ...overrides,
  };
}

/** 決済行の既定値 */
export function makeRow(overrides: Partial<MerchantPaymentRow> = {}): MerchantPaymentRow {
  return {
    id: randomUUID(),
    merchant_id: MERCHANT_ID,
    credential_id: makeCredential().id,
    environment: "test",
    order_id: "AINY-20260912-000123",
    payment_id: newPaymentId(),
    session_id: newSessionId(),
    status: "created",
    amount: 6000,
    currency: "JPY",
    event_id: "RELIT-VOL13",
    event_name: "ReLIT定期公演vol.13",
    event_date: "2026-10-12",
    event_settled_at: null,
    event_cancelled_at: null,
    items: [{ name: "一般チケット", unit_price: 3000, quantity: 2 }],
    customer_email: "buyer@example.com",
    return_url: "https://ainylive.com/checkout/return",
    cancel_url: "https://ainylive.com/checkout/cancel",
    usen_jutyu_cd: "TSJM-0000001",
    usen_attempted_at: null,
    usen_pay_requested_at: null,
    usen_status: null,
    usen_synced_at: null,
    card_brand: null,
    card_last4: null,
    expires_at: "2026-09-28T03:30:00Z",
    captured_at: null,
    refunded_at: null,
    closed_at: null,
    failure_code: null,
    failure_message: null,
    created_at: "2026-09-28T03:00:00Z",
    updated_at: "2026-09-28T03:00:00Z",
    ...overrides,
  };
}

/** 条件付き更新の前提を満たすか（supabase-store の WHERE と同じ意味） */
function matches(row: MerchantPaymentRow, g: UpdateGuard): boolean {
  if (g.statusIn && !g.statusIn.includes(row.status)) return false;
  if (g.jutyuCd && row.usen_jutyu_cd !== g.jutyuCd) return false;
  if (g.attemptedIsNull && row.usen_attempted_at !== null) return false;
  if (g.attemptedIsNotNull && row.usen_attempted_at === null) return false;
  if (g.payRequestedIsNull && row.usen_pay_requested_at !== null) return false;
  return true;
}

/** メモリ上の MerchantApiStore */
export class MemoryStore implements MerchantApiStore {
  payments: MerchantPaymentRow[] = [];
  credentials: CredentialRow[] = [makeCredential()];
  merchants: MerchantInfo[] = [{ id: MERCHANT_ID, name: "株式会社DD AINY LIVE", mall_code: "A304" }];
  webhooks: WebhookDeliveryRow[] = [];
  audits: MerchantAuditEntry[] = [];
  private seq = 0;

  async findCredentialByApiId(apiMerchantId: string) {
    return this.credentials.find((c) => c.api_merchant_id === apiMerchantId) ?? null;
  }
  async getCredential(id: string) {
    return this.credentials.find((c) => c.id === id) ?? null;
  }
  async getMerchant(id: string) {
    return this.merchants.find((m) => m.id === id) ?? null;
  }
  async nextJutyuCd(mallCd: string) {
    this.seq += 1;
    return `${mallCd}-${String(100 + this.seq).padStart(7, "0")}`;
  }
  async findPaymentByOrder(merchantId: string, environment: string, orderId: string) {
    return (
      this.payments.find((p) => p.merchant_id === merchantId && p.environment === environment && p.order_id === orderId) ??
      null
    );
  }
  async findPaymentById(id: string) {
    return this.payments.find((p) => p.id === id) ?? null;
  }
  async findPaymentByPaymentId(paymentId: string) {
    return this.payments.find((p) => p.payment_id === paymentId) ?? null;
  }
  async findPaymentBySessionId(sessionId: string) {
    return this.payments.find((p) => p.session_id === sessionId) ?? null;
  }
  async insertPayment(row: NewMerchantPayment) {
    if (this.payments.some((p) => p.merchant_id === row.merchant_id && p.environment === row.environment && p.order_id === row.order_id)) {
      return "conflict" as const;
    }
    const full = makeRow({ ...row, id: randomUUID(), status: "created", created_at: new Date().toISOString() });
    this.payments.push(full);
    return { ...full };
  }
  async updatePayment(id: string, patch: Partial<MerchantPaymentRow>, guard: UpdateGuard = {}) {
    const row = this.payments.find((p) => p.id === id);
    if (!row || !matches(row, guard)) return null;
    Object.assign(row, patch);
    return { ...row };
  }
  async listPayments() {
    return [...this.payments];
  }
  async listExpiredOpenPayments(before: string) {
    return this.payments.filter((p) => (p.status === "created" || p.status === "pending") && p.expires_at < before);
  }
  async enqueueWebhook(args: { merchantPaymentId: string; eventType: WebhookDeliveryRow["event_type"]; occurredAt: string; url: string }) {
    if (this.webhooks.some((w) => w.merchant_payment_id === args.merchantPaymentId && w.event_type === args.eventType)) return;
    this.webhooks.push({
      id: randomUUID(),
      merchant_payment_id: args.merchantPaymentId,
      event_type: args.eventType,
      occurred_at: args.occurredAt,
      url: args.url,
      attempt: 0,
      status_code: null,
      error_message: null,
      delivered_at: null,
      next_retry_at: args.occurredAt,
    });
  }
  async listDueWebhooks(now: string) {
    return this.webhooks.filter((w) => !w.delivered_at && w.next_retry_at && w.next_retry_at <= now);
  }
  async updateWebhook(id: string, patch: Partial<WebhookDeliveryRow>) {
    const w = this.webhooks.find((x) => x.id === id);
    if (w) Object.assign(w, patch);
  }
  async audit(entry: MerchantAuditEntry) {
    this.audits.push(entry);
  }
}

/** USEN の偽物（応答を差し替え可能・呼び出しを記録） */
export class FakeUsen implements UsenPort {
  tokenInitResult: Awaited<ReturnType<UsenPort["tokenInit"]>> | Error = {
    result: "ok",
    code: "01",
    three_ds_required: true,
    check_cd: "HMcheck",
  };
  payResult: Awaited<ReturnType<UsenPort["pay"]>> | Error = { result: "ok", code: "01", brand: "VISA" };
  trade: Awaited<ReturnType<UsenPort["searchTrade"]>> = { result: "ng", code: "01" };
  refundResult: Awaited<ReturnType<UsenPort["refund"]>> | Error = { result: "ok", code: "40", process_day: "2026/10/08" };
  calls: string[] = [];

  async tokenInit(_p: UsenProfile, input: Parameters<UsenPort["tokenInit"]>[1]) {
    this.calls.push(`tokenInit:${input.jutyuCd}`);
    if (this.tokenInitResult instanceof Error) throw this.tokenInitResult;
    return this.tokenInitResult;
  }
  async pay(_p: UsenProfile, input: { jutyuCd: string }) {
    this.calls.push(`pay:${input.jutyuCd}`);
    if (this.payResult instanceof Error) throw this.payResult;
    return this.payResult;
  }
  async refund(_p: UsenProfile, input: { jutyuCd: string; amount: number; salesDay: string }) {
    this.calls.push(`refund:${input.jutyuCd}:${input.amount}:${input.salesDay}`);
    if (this.refundResult instanceof Error) throw this.refundResult;
    return this.refundResult;
  }
  async searchTrade(_p: UsenProfile, jutyuCd: string) {
    this.calls.push(`searchTrade:${jutyuCd}`);
    return this.trade;
  }
}

/** テスト用の依存一式（時刻は固定・変更可能） */
export function makeDeps(opts: { now?: Date } = {}) {
  const store = new MemoryStore();
  const usen = new FakeUsen();
  const clock = { now: opts.now ?? new Date("2026-09-28T03:00:00Z") };
  const profile: UsenProfile = {
    environment: "test",
    mallCd: "TSJM",
    groupId: "TESTGROUP",
    key: randomBytes(64),
    tokenApiBaseUrl: "https://usen.test/ec-payment-uhup",
    memberApiBaseUrl: "https://usen.test/payment",
    tokenJsUrl: "https://cdn.test/dev.js",
    sdkApiBaseUrl: null,
  };
  const deps: MerchantApiDeps = {
    store,
    usen,
    resolveProfile: () => profile,
    secretsOf: () => [SECRET],
    now: () => clock.now,
    appUrl: "https://app.qolc.jp",
  };
  return { deps, store, usen, clock };
}
