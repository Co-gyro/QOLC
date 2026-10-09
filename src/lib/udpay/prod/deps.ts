import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { pay, tokenInit } from "@/lib/payment/token-ec-api";
import { formatUsenDate, memberGet, nextJutyuCd } from "@/lib/payment/member-api";
import { logPaymentAudit } from "@/lib/payment/audit-log";
import type { CardRegistrationDeps } from "./card-registration";

/**
 * 本番のカード登録で使う実際の依存（USEN API・Supabase・監査ログ）を組み立てる。
 * USEN 本番ホストへの送信は usen-client の誤送信ガード（ALLOW_USEN_PROD / VERCEL_ENV）に従う。
 */
export function createCardRegistrationDeps(ipAddress: string | null): CardRegistrationDeps {
  return {
    client: getSupabaseAdminClient(),
    nextJutyuCd,
    tokenInit: async (params) => (await tokenInit(params)) as unknown as Record<string, unknown>,
    pay,
    memberGet: (args) => memberGet(args, { ipAddress }),
    audit: (entry) =>
      logPaymentAudit({ action: entry.action, request: entry.request, response: entry.response, ipAddress }),
    formatUsenDate: () => formatUsenDate(),
  };
}
