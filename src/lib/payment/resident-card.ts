import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * QOLC 家族（支払いオーナー）の登録カード情報の保存（migration 042）。
 * 会員IDの保存は必須、ブランド・下4桁・有効期限は 042 未適用でも登録自体を止めないよう別に保存する。
 */

/** 保存するカード情報 */
export interface ResidentCardInfo {
  brand: string | null;
  last4: string | null;
  expireYm: string | null;
}

/**
 * 会員IDとカード情報を保存する（カード変更のときも上書き）。
 * @returns 会員IDの保存に失敗したときだけエラー
 */
export async function saveResidentCard(
  client: SupabaseClient,
  residentAccountId: string,
  memberId: string,
  card: ResidentCardInfo,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await client.from("resident_accounts").update({ usen_member_id: memberId }).eq("id", residentAccountId);
  if (error) return { ok: false, error: error.message };
  // 042 未適用（列なし）なら無視する
  await client
    .from("resident_accounts")
    .update({
      card_brand: card.brand,
      card_last4: card.last4,
      card_expire_ym: card.expireYm,
      card_checked_at: card.expireYm ? new Date().toISOString() : null,
    })
    .eq("id", residentAccountId);
  return { ok: true };
}
