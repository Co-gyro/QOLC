import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { authByMemberId, nextJutyuCd, salesAdd, searchTrade } from "@/lib/payment/member-api";
import type { ChargeDeps } from "./charge";

/**
 * 本番の課金で使う実際の依存（USEN 会員ID決済API・Supabase）。
 * USEN 本番ホストへの送信は usen-client の誤送信ガード（VERCEL_ENV=production / ALLOW_USEN_PROD=1）に従う。
 * 与信・売上計上・取引照会は member-api 側で payment_audit_logs に記録される。
 */
export function createChargeDeps(performedBy: string | null = null): ChargeDeps {
  return {
    client: getSupabaseAdminClient(),
    nextJutyuCd,
    authByMemberId: (args) => authByMemberId(args, { performedBy }),
    salesAdd: (args) => salesAdd(args, { performedBy }),
    searchTrade: (args) => searchTrade(args, { performedBy }),
    now: () => new Date(),
  };
}
