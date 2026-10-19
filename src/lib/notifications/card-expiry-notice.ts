import type { SupabaseClient } from "@supabase/supabase-js";
import { formatExpireYm, isExpiryNoticeDay } from "@/lib/payment/card-expiry";
import { notifyResidentAccount, type NotifyInput } from "./notify";

/**
 * QOLC 家族へのカード有効期限の案内（段階D-2）。毎朝の自動処理から呼び、月初（1日）だけ動く。
 * 期限月の前月1日と期限月1日に、支払いオーナーへ「お知らせ」を記録し、LINE 連携していれば LINE でも送る。
 * 同じ月に同じアカウントへ二重に送らない（notifications の type=card_expiring で判定）。
 * migration 042（resident_accounts.card_expire_ym）未適用なら何もしない。
 */

/** お知らせの見出しと本文 */
export function buildResidentExpiryNotice(input: { expireYm: string; thisMonth: boolean; cardLabel: string; url: string }) {
  const when = input.thisMonth ? "今月末" : "来月末";
  return {
    title: "ご登録カードの有効期限が近づいています",
    body: `毎月のお支払いにご登録のクレジットカード（${input.cardLabel}）の有効期限が、${when}（${formatExpireYm(input.expireYm)}）で切れます。
新しいカードが届きましたら、下記から新しいカードのご登録をお願いいたします（同じ番号で有効期限だけ変わった場合も、ご登録が必要です）。
${input.url}`,
  };
}

/** 案内の結果 */
export interface ResidentExpiryResult {
  notified: number;
  skipped: number;
}

/**
 * 有効期限の案内を送る（今日が月初でなければ何もしない）。
 * @param today 日本時間の今日 YYYY-MM-DD
 */
export async function runResidentExpiryNotices(
  client: SupabaseClient,
  today: string,
  appUrl: string,
  notify: (admin: SupabaseClient, input: NotifyInput) => Promise<void> = notifyResidentAccount,
): Promise<ResidentExpiryResult> {
  const result: ResidentExpiryResult = { notified: 0, skipped: 0 };
  if (!today.endsWith("-01")) return result;
  const { data, error } = await client
    .from("resident_accounts")
    .select("id, card_brand, card_last4, card_expire_ym")
    .eq("is_payment_owner", true)
    .not("usen_member_id", "is", null)
    .not("card_expire_ym", "is", null)
    .is("deleted_at", null);
  // 042 未適用（列なし）
  if (error) return result;
  const rows = (data ?? []) as { id: string; card_brand: string | null; card_last4: string | null; card_expire_ym: string }[];
  const monthStart = `${today.slice(0, 7)}-01T00:00:00+09:00`;
  for (const a of rows.filter((r) => isExpiryNoticeDay(r.card_expire_ym, today))) {
    const { data: already } = await client
      .from("notifications")
      .select("id")
      .eq("resident_account_id", a.id)
      .eq("type", "card_expiring")
      .gte("created_at", monthStart)
      .limit(1);
    if (already?.length) {
      result.skipped++;
      continue;
    }
    const n = buildResidentExpiryNotice({
      expireYm: a.card_expire_ym,
      thisMonth: a.card_expire_ym === today.slice(0, 7).replace("-", ""),
      cardLabel: [a.card_brand, a.card_last4 ? `下4桁 ${a.card_last4}` : null].filter(Boolean).join(" ") || "ご登録のカード",
      url: `${appUrl.replace(/\/$/, "")}/user/card/register?ra=${a.id}`,
    });
    await notify(client, { residentAccountId: a.id, type: "card_expiring", title: n.title, body: n.body });
    result.notified++;
  }
  return result;
}
