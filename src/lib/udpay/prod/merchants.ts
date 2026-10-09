import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * UD Payment を利用する加盟店（udpay_merchant_settings に行がある merchants）。
 */
export interface UdpayMerchant {
  id: string;
  name: string;
  /** USEN モールコード（受注コードの接頭辞。例: A303） */
  mallCode: string | null;
  /** 顧客に設定できる決済日 */
  chargeDays: number[];
  contactPerson: string | null;
  replyTo: string | null;
  logoPath: string | null;
}

interface SettingsRow {
  merchant_id: string;
  charge_days: number[];
  display_name: string | null;
  contact_person: string | null;
  reply_to: string | null;
  logo_path: string | null;
  merchants: { name: string; mall_code: string | null; deleted_at: string | null } | null;
}

const SELECT =
  "merchant_id, charge_days, display_name, contact_person, reply_to, logo_path, merchants!inner(name, mall_code, deleted_at)";

/** 設定行を加盟店に変換する */
function toMerchant(row: SettingsRow): UdpayMerchant {
  return {
    id: row.merchant_id,
    name: row.display_name ?? row.merchants?.name ?? "",
    mallCode: row.merchants?.mall_code ?? null,
    chargeDays: [...(row.charge_days ?? [])].sort((a, b) => a - b),
    contactPerson: row.contact_person,
    replyTo: row.reply_to,
    logoPath: row.logo_path,
  };
}

/** UD Payment 加盟店の一覧 */
export async function listUdpayMerchants(client: SupabaseClient): Promise<UdpayMerchant[]> {
  const { data, error } = await client.from("udpay_merchant_settings").select(SELECT);
  if (error) throw new Error(`加盟店の取得に失敗: ${error.message}`);
  return ((data ?? []) as unknown as SettingsRow[])
    .filter((r) => r.merchants && !r.merchants.deleted_at)
    .map(toMerchant);
}

/** UD Payment 加盟店1件（UD Payment 未設定なら null） */
export async function getUdpayMerchant(client: SupabaseClient, merchantId: string): Promise<UdpayMerchant | null> {
  const { data, error } = await client
    .from("udpay_merchant_settings")
    .select(SELECT)
    .eq("merchant_id", merchantId)
    .maybeSingle();
  if (error) throw new Error(`加盟店の取得に失敗: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as SettingsRow;
  return row.merchants && !row.merchants.deleted_at ? toMerchant(row) : null;
}
