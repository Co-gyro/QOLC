/**
 * 加盟店のカード会社番号（JCB 2種 + セゾン）の取得・更新クライアント
 *
 * JCB は施設ごとに「登録型（会員ID決済・継続課金用）」と「都度型EC（トークン決済用）」の
 * 2種類の加盟店番号が発番される。表示・編集は加盟店管理画面のみで行い、
 * 更新は API（PATCH /api/admin/merchants/[id]/card-codes）経由で監査ログを残す。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/** 1加盟店分のカード会社番号 */
export interface MerchantCardCodes {
  jcbRecurring: string | null;
  jcbEc: string | null;
  saison: string | null;
}

/** 加盟店ID → カード会社番号 のマップを取得する（論理削除除く） */
export async function fetchMerchantCardCodes(): Promise<Map<string, MerchantCardCodes>> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("merchants")
    .select("id, jcb_merchant_code_recurring, jcb_merchant_code_ec, saison_merchant_code")
    .is("deleted_at", null);
  if (error) throw new Error(`加盟店番号の取得に失敗しました: ${error.message}`);
  const map = new Map<string, MerchantCardCodes>();
  for (const r of (data ?? []) as Array<{
    id: string;
    jcb_merchant_code_recurring: string | null;
    jcb_merchant_code_ec: string | null;
    saison_merchant_code: string | null;
  }>) {
    map.set(r.id, {
      jcbRecurring: r.jcb_merchant_code_recurring,
      jcbEc: r.jcb_merchant_code_ec,
      saison: r.saison_merchant_code,
    });
  }
  return map;
}

/** カード会社番号を更新する（監査ログ付きの管理APIを経由） */
export async function updateMerchantCardCodes(
  id: string,
  codes: MerchantCardCodes
): Promise<void> {
  const res = await fetch(`/api/admin/merchants/${id}/card-codes`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jcb_merchant_code_recurring: codes.jcbRecurring,
      jcb_merchant_code_ec: codes.jcbEc,
      saison_merchant_code: codes.saison,
    }),
  });
  const json = (await res.json()) as
    | { success: true; data: { id: string } }
    | { success: false; error: string };
  if (!json.success) throw new Error(json.error);
}

/**
 * カード会社番号のクライアント側検証（半角数字のみ・桁上限）。
 * @returns エラーメッセージ（問題なければ null）
 */
export function validateCardCodes(codes: MerchantCardCodes): string | null {
  const digits = /^[0-9]*$/;
  if (codes.jcbRecurring && (!digits.test(codes.jcbRecurring) || codes.jcbRecurring.length > 17)) {
    return "JCB加盟店番号（登録型）は半角数字17桁以内で入力してください";
  }
  if (codes.jcbEc && (!digits.test(codes.jcbEc) || codes.jcbEc.length > 17)) {
    return "JCB加盟店番号（都度型EC）は半角数字17桁以内で入力してください";
  }
  if (codes.saison && (!digits.test(codes.saison) || codes.saison.length > 7)) {
    return "セゾン加盟店番号は半角数字7桁以内で入力してください";
  }
  return null;
}
