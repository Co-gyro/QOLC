import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 加盟店カルテの「概要」「接続情報」「カード会社・精算」に出すデータ。
 * 加盟店が使っているサービスは、各サービスの設定の有無から判定する
 * （契約・ライセンスの記録は段階2で merchant_services を追加して置き換える）。
 */

/** 加盟店の基本情報 */
export interface MerchantBasics {
  id: string;
  name: string;
  nameKana: string | null;
  address: string | null;
  phone: string | null;
  mallCode: string | null;
  terminalId: string | null;
  jcbEc: string | null;
  jcbRecurring: string | null;
  saison: string | null;
  invoiceRegistrationNumber: string | null;
  createdAt: string;
}

/** API の接続情報（鍵の本体は持たない） */
export interface ApiCredentialView {
  environment: "test" | "production";
  apiMerchantId: string;
  status: "active" | "suspended" | "revoked";
  allowedDomains: string[];
  webhookUrl: string | null;
  createdAt: string;
  /** 鍵を作り直した直後、古い鍵が使える期限 */
  previousSecretExpiresAt: string | null;
}

/** 加盟店カルテの概要 */
export interface MerchantOverview {
  merchant: MerchantBasics;
  services: {
    udpay: { chargeDays: number[]; customers: number; cardRegistered: number; capturedThisMonth: number; failedThisMonth: number } | null;
    merchantApi: { credentials: ApiCredentialView[]; succeeded30d: number; failed30d: number } | null;
    qolc: { activeFacilities: number } | null;
  };
}

/** 加盟店カルテの概要を読み込む（見つからなければ null） */
export async function loadMerchantOverview(client: SupabaseClient, merchantId: string, now: Date = new Date()): Promise<MerchantOverview | null> {
  const { data: m } = await client
    .from("merchants")
    .select("id, name, name_kana, address, phone, mall_code, terminal_id, jcb_merchant_code_ec, jcb_merchant_code_recurring, saison_merchant_code, invoice_registration_number, created_at")
    .eq("id", merchantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!m) return null;
  const monthStart = `${new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 7)}-01`;
  const since30 = new Date(now.getTime() - 30 * 86400_000).toISOString();
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;

  const [{ data: settings }, { data: creds }, facilities] = await Promise.all([
    client.from("udpay_merchant_settings").select("charge_days").eq("merchant_id", merchantId).maybeSingle(),
    client
      .from("merchant_api_credentials")
      .select("environment, api_merchant_id, allowed_domains, webhook_url, created_at, previous_secret_expires_at, suspended_at, revoked_at")
      .eq("merchant_id", merchantId)
      .is("deleted_at", null),
    count(client.from("facility_merchant_relations").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).eq("status", "active")),
  ]);

  let udpay: MerchantOverview["services"]["udpay"] = null;
  if (settings) {
    const [customers, cardRegistered, capturedThisMonth, failedThisMonth] = await Promise.all([
      count(client.from("udpay_customers").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).is("deleted_at", null)),
      count(client.from("udpay_customers").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).is("deleted_at", null).not("usen_member_id", "is", null)),
      count(client.from("udpay_payments").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).eq("status", "captured").gte("scheduled_date", monthStart)),
      count(client.from("udpay_payments").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).eq("status", "failed").gte("scheduled_date", monthStart)),
    ]);
    udpay = { chargeDays: (settings.charge_days as number[]) ?? [], customers, cardRegistered, capturedThisMonth, failedThisMonth };
  }

  let merchantApi: MerchantOverview["services"]["merchantApi"] = null;
  const credRows = (creds ?? []) as {
    environment: "test" | "production"; api_merchant_id: string; allowed_domains: string[] | null; webhook_url: string | null;
    created_at: string; previous_secret_expires_at: string | null; suspended_at: string | null; revoked_at: string | null;
  }[];
  if (credRows.length) {
    const [succeeded30d, failed30d] = await Promise.all([
      count(client.from("merchant_payments").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).eq("environment", "production").eq("status", "succeeded").gte("created_at", since30)),
      count(client.from("merchant_payments").select("id", { count: "exact", head: true }).eq("merchant_id", merchantId).eq("environment", "production").eq("status", "failed").gte("created_at", since30)),
    ]);
    merchantApi = {
      credentials: credRows
        .map((c) => ({
          environment: c.environment,
          apiMerchantId: c.api_merchant_id,
          status: c.revoked_at ? ("revoked" as const) : c.suspended_at ? ("suspended" as const) : ("active" as const),
          allowedDomains: c.allowed_domains ?? [],
          webhookUrl: c.webhook_url,
          createdAt: c.created_at,
          previousSecretExpiresAt: c.previous_secret_expires_at,
        }))
        .sort((a, b) => (a.environment === b.environment ? 0 : a.environment === "production" ? -1 : 1)),
      succeeded30d,
      failed30d,
    };
  }

  return {
    merchant: {
      id: m.id as string,
      name: m.name as string,
      nameKana: (m.name_kana as string | null) ?? null,
      address: (m.address as string | null) ?? null,
      phone: (m.phone as string | null) ?? null,
      mallCode: (m.mall_code as string | null) ?? null,
      terminalId: (m.terminal_id as string | null) ?? null,
      jcbEc: (m.jcb_merchant_code_ec as string | null) ?? null,
      jcbRecurring: (m.jcb_merchant_code_recurring as string | null) ?? null,
      saison: (m.saison_merchant_code as string | null) ?? null,
      invoiceRegistrationNumber: (m.invoice_registration_number as string | null) ?? null,
      createdAt: m.created_at as string,
    },
    services: { udpay, merchantApi, qolc: facilities > 0 ? { activeFacilities: facilities } : null },
  };
}
