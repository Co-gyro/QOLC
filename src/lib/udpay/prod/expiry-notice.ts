import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { SUPPORT_EMAIL } from "@/lib/email/templates";
import { formatExpireYm, isExpiryNoticeDay } from "@/lib/payment/card-expiry";
import { registrationUrl } from "./identifiers";
import type { SendFn } from "./mail";

/**
 * UD Payment のカード有効期限の案内（段階D）。毎朝の自動処理から呼び、月初（1日）だけ動く。
 * 期限月の前月1日と期限月1日に、顧客（To/CC）へ「新しいカードの登録」の案内メール（登録リンク付き）を送り、
 * 加盟店の利用者全員と UD には対象の一覧を送る。同じ月に同じ顧客へ二重に送らない（送付履歴で判定）。
 */

/** 案内メールの件名の目印（送付履歴での重複判定に使う） */
export const EXPIRY_SUBJECT_MARK = "ご登録カードの有効期限";

/** 顧客あての案内メール */
export function buildExpiryMail(input: {
  merchantName: string;
  customerName: string;
  contactName: string | null;
  expireYm: string;
  /** 期限月の1日なら true（今月末で期限）、前月なら false（来月末で期限） */
  thisMonth: boolean;
  url: string;
  cardLabel: string;
}) {
  const to = input.contactName ? `${input.customerName}\n${input.contactName}様` : `${input.customerName} 御中`;
  const when = input.thisMonth ? "今月末" : "来月末";
  return {
    subject: `【${input.merchantName}】${EXPIRY_SUBJECT_MARK}が近づいています`,
    text: `${to}

いつも大変お世話になっております。
${input.merchantName}でございます。

毎月のお支払いにご登録いただいているクレジットカード（${input.cardLabel}）の有効期限が、${when}（${formatExpireYm(input.expireYm)}）で切れます。
有効期限が切れると、翌月以降のお支払いができなくなります。

カード会社から新しいカードが届きましたら、お手数ですが下記のリンクから、新しいカードのご登録をお願いいたします（同じカード番号で有効期限だけ変わった場合も、ご登録が必要です）。

▼カードの登録・変更
${input.url}

・ご登録の確認のため1円の確認（与信）を行いますが、実際には請求されません。
・登録が完了すると、次回のお支払いから新しいカードでお支払いいただきます。

ご不明な点がございましたら、${input.merchantName}の担当者までお問い合わせください。

※このメールは送信専用アドレスから送信しています。

${input.merchantName}
（決済システム提供：株式会社ユニバーサル・デベロップメント）`,
  };
}

interface CustomerRow {
  id: string;
  merchant_id: string;
  name: string;
  contact_name: string | null;
  registration_token: string;
  card_brand: string | null;
  card_last4: string | null;
  card_expire_ym: string | null;
}

/** 加盟店の利用者のメールアドレス（*.test は除く） */
async function memberEmails(client: SupabaseClient, merchantId: string): Promise<string[]> {
  const { data } = await client.from("udpay_members").select("user_id").eq("merchant_id", merchantId).is("deleted_at", null);
  const out: string[] = [];
  for (const m of (data ?? []) as { user_id: string }[]) {
    const { data: u } = await client.auth.admin.getUserById(m.user_id);
    if (u?.user?.email && !u.user.email.endsWith(".test")) out.push(u.user.email);
  }
  return out;
}

/** 案内の結果 */
export interface ExpiryNoticeResult {
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * 有効期限の案内を送る（今日が月初でなければ何もしない）。
 * @param today 日本時間の今日 YYYY-MM-DD
 */
export async function runExpiryNotices(
  client: SupabaseClient,
  today: string,
  appUrl: string,
  send: SendFn = sendEmail,
): Promise<ExpiryNoticeResult> {
  const result: ExpiryNoticeResult = { sent: 0, skipped: 0, failed: 0 };
  if (!today.endsWith("-01")) return result;
  const { data } = await client
    .from("udpay_customers")
    .select("id, merchant_id, name, contact_name, registration_token, card_brand, card_last4, card_expire_ym")
    .not("usen_member_id", "is", null)
    .not("card_expire_ym", "is", null)
    .is("deleted_at", null);
  const targets = ((data ?? []) as CustomerRow[]).filter((c) => isExpiryNoticeDay(c.card_expire_ym, today));
  if (targets.length === 0) return result;

  const monthStart = `${today.slice(0, 7)}-01T00:00:00+09:00`;
  const byMerchant = new Map<string, string[]>();
  for (const c of targets) {
    const { data: already } = await client
      .from("udpay_mail_logs")
      .select("id")
      .eq("customer_id", c.id)
      .eq("kind", "card_registration")
      .like("subject", `%${EXPIRY_SUBJECT_MARK}%`)
      .gte("created_at", monthStart)
      .limit(1);
    if (already?.length) {
      result.skipped++;
      continue;
    }
    const [{ data: settings }, { data: contacts }] = await Promise.all([
      client.from("udpay_merchant_settings").select("display_name, reply_to").eq("merchant_id", c.merchant_id).maybeSingle(),
      client.from("udpay_customer_contacts").select("kind, email").eq("customer_id", c.id).is("deleted_at", null),
    ]);
    const to = ((contacts ?? []) as { kind: string; email: string }[]).filter((x) => x.kind === "to").map((x) => x.email);
    const cc = ((contacts ?? []) as { kind: string; email: string }[]).filter((x) => x.kind === "cc").map((x) => x.email);
    const merchantName = (settings?.display_name as string | null) ?? "加盟店";
    const thisMonth = c.card_expire_ym === today.slice(0, 7).replace("-", "");
    const mail = buildExpiryMail({
      merchantName,
      customerName: c.name,
      contactName: c.contact_name,
      expireYm: c.card_expire_ym as string,
      thisMonth,
      url: registrationUrl(c.registration_token, appUrl),
      cardLabel: [c.card_brand, c.card_last4 ? `下4桁 ${c.card_last4}` : null].filter(Boolean).join(" ") || "ご登録のカード",
    });
    const r = to.length
      ? await send({ to, cc, subject: mail.subject, text: mail.text, fromName: merchantName, replyTo: (settings?.reply_to as string | null) ?? undefined })
      : { sent: false, skipped: false, error: "宛先（To）がありません" };
    const status = r.sent ? "sent" : r.skipped ? "skipped" : "failed";
    await client.from("udpay_mail_logs").insert({
      merchant_id: c.merchant_id,
      kind: "card_registration",
      customer_id: c.id,
      to_addrs: to,
      cc_addrs: cc,
      subject: mail.subject,
      status,
      provider_id: "id" in r ? (r.id ?? null) : null,
      error: r.error ?? null,
    });
    if (status === "failed") result.failed++;
    else result.sent++;
    const list = byMerchant.get(c.merchant_id) ?? [];
    list.push(`・${c.name}（${formatExpireYm(c.card_expire_ym)}まで${status === "failed" ? "／案内メールの送信に失敗" : ""}）`);
    byMerchant.set(c.merchant_id, list);
  }

  // 加盟店の利用者と UD への一覧
  const udLines: string[] = [];
  for (const [merchantId, lines] of Array.from(byMerchant.entries())) {
    const { data: s } = await client.from("udpay_merchant_settings").select("display_name").eq("merchant_id", merchantId).maybeSingle();
    const name = (s?.display_name as string | null) ?? "加盟店";
    const text = `${name} ご担当者様

ご登録カードの有効期限が近いお客様へ、新しいカードの登録のご案内メールをお送りしました（${lines.length}件）。

${lines.join("\n")}

新しいカードが登録されるまでは、有効期限が切れたあとのお支払いができません。必要に応じてお客様へご連絡ください。
顧客管理の「有効期限が近い」で一覧を確認できます: ${appUrl.replace(/\/$/, "")}/billing/customers?card=expiring

UD Payment（株式会社ユニバーサル・デベロップメント）`;
    const to = await memberEmails(client, merchantId);
    if (to.length) await send({ to, subject: `【UD Payment】カードの有効期限が近いお客様（${lines.length}件）`, text, fromName: "UD Payment" });
    udLines.push(`━━ ${name} ━━`, ...lines, "");
  }
  if (udLines.length) {
    await send({ to: SUPPORT_EMAIL, subject: `【UD Payment運用】${today} カード有効期限の案内 ${result.sent + result.failed}件`, text: udLines.join("\n"), fromName: "UD Payment" });
  }
  return result;
}
