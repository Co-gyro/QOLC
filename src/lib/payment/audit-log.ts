/**
 * 決済監査ログ
 *
 * USEN PSP API の呼び出し記録、決済操作の記録を `payment_audit_logs` テーブルに残す。
 * - DELETE 権限は付与されていない（DBレベルで保証）
 * - リクエスト/レスポンスは JSONB で保存
 * - 機密情報（カード番号、HMACキー等）が混入しないよう、保存前にマスキングする
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditAction } from "./types";

/** マスキング対象のキー名（部分一致、小文字比較） */
const MASK_KEY_PATTERNS = [
  "card_no",
  "cardno",
  "card_number",
  "cvv",
  "cvc",
  "expiry",
  "expdate",
  "security_code",
  "hmac",
  "secret",
  "password",
  "token",
  "api_key",
];

/**
 * オブジェクトを再帰的にマスキングする（機密キーは "***" に置換）。
 */
export function maskSensitive<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (typeof input !== "object") return input;

  if (Array.isArray(input)) {
    return input.map((v) => maskSensitive(v)) as unknown as T;
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (MASK_KEY_PATTERNS.some((p) => lower.includes(p))) {
      out[k] = "***";
    } else {
      out[k] = maskSensitive(v);
    }
  }
  return out as T;
}

export interface AuditLogInput {
  paymentId?: string | null;
  action: AuditAction | string;
  /** API リクエスト本文（マスキング前） */
  request?: unknown;
  /** API レスポンス本文（マスキング前） */
  response?: unknown;
  /** 実行ユーザー（auth.users.id） */
  performedBy?: string | null;
  /** リクエスト元 IP */
  ipAddress?: string | null;
  /** 既に admin クライアントを持っている場合は注入（テスト用） */
  client?: SupabaseClient;
}

/**
 * 決済操作を `payment_audit_logs` に1件INSERTする。
 *
 * @returns 挿入成功時は true（失敗してもアプリは続行できるよう例外は投げない）
 */
export async function logPaymentAudit(
  input: AuditLogInput
): Promise<boolean> {
  const client = input.client ?? getSupabaseAdminClient();

  const row = {
    payment_id: input.paymentId ?? null,
    action: input.action,
    performed_by: input.performedBy ?? null,
    request_body: input.request ? maskSensitive(input.request) : null,
    response_body: input.response ? maskSensitive(input.response) : null,
    ip_address: input.ipAddress ?? null,
  };

  const { error } = await client.from("payment_audit_logs").insert(row);
  if (error) {
    // 監査ログの失敗はアプリを止めない（ただしサーバーログには残す）
    // 機密情報の漏洩を避けるため error.message のみ出力
    console.error("[payment_audit] insert failed:", error.message);
    return false;
  }
  return true;
}
