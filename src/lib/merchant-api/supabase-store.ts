/**
 * MerchantApiStore の Supabase 実装（service_role で RLS をバイパスして動く）
 *
 * クエリはすべてクエリビルダーで組み立てる（生SQLは使わない）。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { logPaymentAudit } from "@/lib/payment/audit-log";
import type { MerchantApiStore, MerchantAuditEntry } from "./store";
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

const CREDENTIAL_COLUMNS =
  "id, merchant_id, environment, api_merchant_id, secret_enc, secret_last4, previous_secret_enc, " +
  "previous_secret_expires_at, allowed_domains, webhook_url, max_event_months, amount_limit_per_payment, " +
  "max_expires_in, suspended_at, revoked_at";

/** PostgreSQL の一意制約違反 */
const UNIQUE_VIOLATION = "23505";

/**
 * Supabase のエラーを例外にする（エラー本文は内部ログ用。外部には出さない）。
 */
function fail(context: string, error: { message: string } | null): never {
  throw new Error(`[merchant-api] ${context}: ${error?.message ?? "unknown"}`);
}

/**
 * Supabase を使う MerchantApiStore を作る。
 *
 * @param client - 省略時は service_role クライアント
 */
export function createSupabaseMerchantApiStore(client?: SupabaseClient): MerchantApiStore {
  const db = (): SupabaseClient => client ?? getSupabaseAdminClient();

  return {
    async findCredentialByApiId(apiMerchantId) {
      const { data, error } = await db()
        .from("merchant_api_credentials")
        .select(CREDENTIAL_COLUMNS)
        .eq("api_merchant_id", apiMerchantId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) fail("findCredentialByApiId", error);
      return (data as unknown as CredentialRow | null) ?? null;
    },

    async getCredential(id) {
      const { data, error } = await db()
        .from("merchant_api_credentials")
        .select(CREDENTIAL_COLUMNS)
        .eq("id", id)
        .maybeSingle();
      if (error) fail("getCredential", error);
      return (data as unknown as CredentialRow | null) ?? null;
    },

    async getMerchant(id) {
      const { data, error } = await db()
        .from("merchants")
        .select("id, name, mall_code")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) fail("getMerchant", error);
      return (data as MerchantInfo | null) ?? null;
    },

    async nextJutyuCd(mallCd) {
      const { data, error } = await db().rpc("next_jutyu_cd", { p_mall_cd: mallCd });
      if (error) fail("nextJutyuCd", error);
      if (typeof data !== "string") throw new Error("[merchant-api] jutyu_cd の採番結果が不正です");
      return data;
    },

    async findPaymentByOrder(merchantId, environment, orderId) {
      const { data, error } = await db()
        .from("merchant_payments")
        .select("*")
        .eq("merchant_id", merchantId)
        .eq("environment", environment)
        .eq("order_id", orderId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) fail("findPaymentByOrder", error);
      return (data as MerchantPaymentRow | null) ?? null;
    },

    async findPaymentById(id) {
      const { data, error } = await db()
        .from("merchant_payments")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) fail("findPaymentById", error);
      return (data as MerchantPaymentRow | null) ?? null;
    },

    async findPaymentByPaymentId(paymentId) {
      const { data, error } = await db()
        .from("merchant_payments")
        .select("*")
        .eq("payment_id", paymentId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) fail("findPaymentByPaymentId", error);
      return (data as MerchantPaymentRow | null) ?? null;
    },

    async findPaymentBySessionId(sessionId) {
      const { data, error } = await db()
        .from("merchant_payments")
        .select("*")
        .eq("session_id", sessionId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) fail("findPaymentBySessionId", error);
      return (data as MerchantPaymentRow | null) ?? null;
    },

    async insertPayment(row: NewMerchantPayment) {
      const { data, error } = await db().from("merchant_payments").insert(row).select("*").single();
      if (error) {
        if ((error as { code?: string }).code === UNIQUE_VIOLATION) return "conflict";
        fail("insertPayment", error);
      }
      return data as MerchantPaymentRow;
    },

    async updatePayment(id: string, patch: Partial<MerchantPaymentRow>, guard: UpdateGuard = {}) {
      let q = db().from("merchant_payments").update(patch).eq("id", id);
      if (guard.statusIn) q = q.in("status", guard.statusIn);
      if (guard.jutyuCd) q = q.eq("usen_jutyu_cd", guard.jutyuCd);
      if (guard.attemptedIsNull) q = q.is("usen_attempted_at", null);
      if (guard.attemptedIsNotNull) q = q.not("usen_attempted_at", "is", null);
      if (guard.payRequestedIsNull) q = q.is("usen_pay_requested_at", null);
      const { data, error } = await q.select("*").maybeSingle();
      if (error) fail("updatePayment", error);
      return (data as MerchantPaymentRow | null) ?? null;
    },

    async listPayments(filter: PaymentListFilter) {
      let q = db()
        .from("merchant_payments")
        .select("*")
        .eq("merchant_id", filter.merchantId)
        .eq("environment", filter.environment)
        .is("deleted_at", null)
        .gte("created_at", filter.from)
        .lt("created_at", filter.to);
      if (filter.statuses && filter.statuses.length > 0) q = q.in("status", filter.statuses);
      if (filter.eventId) q = q.eq("event_id", filter.eventId);
      if (filter.cursor) {
        const { createdAt, id } = filter.cursor;
        // 値に "." や ":" を含むためダブルクォートで囲む（PostgREST の論理フィルタ）
        q = q.or(`created_at.gt."${createdAt}",and(created_at.eq."${createdAt}",id.gt.${id})`);
      }
      const { data, error } = await q
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(filter.limit);
      if (error) fail("listPayments", error);
      return (data as MerchantPaymentRow[]) ?? [];
    },

    async listExpiredOpenPayments(before, limit) {
      const { data, error } = await db()
        .from("merchant_payments")
        .select("*")
        .in("status", ["created", "pending"])
        .lt("expires_at", before)
        .is("deleted_at", null)
        .order("expires_at", { ascending: true })
        .limit(limit);
      if (error) fail("listExpiredOpenPayments", error);
      return (data as MerchantPaymentRow[]) ?? [];
    },

    async enqueueWebhook(args: {
      merchantPaymentId: string;
      eventType: WebhookEventType;
      occurredAt: string;
      url: string;
    }) {
      const { error } = await db()
        .from("merchant_webhook_deliveries")
        .upsert(
          {
            merchant_payment_id: args.merchantPaymentId,
            event_type: args.eventType,
            occurred_at: args.occurredAt,
            url: args.url,
            attempt: 0,
            next_retry_at: args.occurredAt,
          },
          { onConflict: "merchant_payment_id,event_type", ignoreDuplicates: true }
        );
      if (error) fail("enqueueWebhook", error);
    },

    async listDueWebhooks(now, limit) {
      const { data, error } = await db()
        .from("merchant_webhook_deliveries")
        .select("id, merchant_payment_id, event_type, occurred_at, url, attempt, status_code, error_message, delivered_at, next_retry_at")
        .is("delivered_at", null)
        .is("deleted_at", null)
        .not("next_retry_at", "is", null)
        .lte("next_retry_at", now)
        .order("next_retry_at", { ascending: true })
        .limit(limit);
      if (error) fail("listDueWebhooks", error);
      return (data as WebhookDeliveryRow[]) ?? [];
    },

    async updateWebhook(id, patch) {
      const { error } = await db().from("merchant_webhook_deliveries").update(patch).eq("id", id);
      if (error) fail("updateWebhook", error);
    },

    async audit(entry: MerchantAuditEntry) {
      // payment_audit_logs.payment_id は介護決済(payments)への外部キーのため null とし、
      // 加盟店APIの決済は本文の merchant_payment_id で辿れるようにする
      await logPaymentAudit({
        paymentId: null,
        action: entry.action,
        request: { merchant_payment_id: entry.merchantPaymentId, ...(asObject(entry.request)) },
        response: entry.response,
        ipAddress: entry.ipAddress ?? null,
      });
    },
  };
}

/** 監査ログ本文に展開できるようオブジェクトに寄せる */
function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return value === undefined ? {} : { value };
}
