import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type SendEmailResult } from "@/lib/email/send";
import type { ProdCustomer } from "./customers";
import type { UdpayMerchant } from "./merchants";

/**
 * UD Payment（本番）のメール。送信結果は udpay_mail_logs に必ず記録する。
 */

/** カード登録のご案内メールの件名・本文 */
export function buildCardRegistrationMail(input: {
  merchantName: string;
  customerName: string;
  contactName: string | null;
  url: string;
  chargeDay: number | null;
}): { subject: string; text: string } {
  const to = input.contactName ? `${input.customerName}\n${input.contactName}様` : `${input.customerName} 御中`;
  const day = input.chargeDay ? `毎月${input.chargeDay}日` : "毎月の決済日";
  return {
    subject: `【${input.merchantName}】お支払いカードご登録のお願い`,
    text: `${to}

いつも大変お世話になっております。
${input.merchantName}でございます。

今後のサービス利用料のお支払いを、クレジットカードによる自動決済に切り替えさせていただきます。
お手数ですが、下記のリンクからお支払いに使用するクレジットカードをご登録ください。

▼カード登録ページ
${input.url}

・ご登録のカードで、${input.merchantName}からのご請求を${day}に自動でお支払いいただきます（お振込は不要です）。
・ご請求の内容は、お支払いの前にメールでお知らせします。
・ご登録の確認のため、1円の確認（与信）を行いますが、実際には請求されません。
・カード番号は決済代行会社で安全に管理され、${input.merchantName}では保持しません。

ご不明な点がございましたら、${input.merchantName}の担当者までお問い合わせください。

※このメールは送信専用アドレスから送信しています。

${input.merchantName}
（決済システム提供：株式会社ユニバーサル・デベロップメント）`,
  };
}

/** 送信関数（テストで差し替える） */
export type SendFn = (input: Parameters<typeof sendEmail>[0]) => Promise<SendEmailResult>;

/**
 * カード登録のご案内を、顧客の宛先（To/CC）へ送り、送付履歴に残す。
 * RESEND_API_KEY 未設定の環境では送らずに skipped として記録する。
 */
export async function sendCardRegistrationMail(
  client: SupabaseClient,
  args: { customer: ProdCustomer; merchant: UdpayMerchant; url: string; sentBy: string | null },
  send: SendFn = sendEmail,
): Promise<{ status: "sent" | "skipped" | "failed"; error?: string }> {
  const to = args.customer.contacts.filter((c) => c.kind === "to").map((c) => c.email);
  const cc = args.customer.contacts.filter((c) => c.kind === "cc").map((c) => c.email);
  if (to.length === 0) return { status: "failed", error: "宛先（To）が登録されていません" };
  const mail = buildCardRegistrationMail({
    merchantName: args.merchant.name,
    customerName: args.customer.name,
    contactName: args.customer.contactName,
    url: args.url,
    chargeDay: args.customer.chargeDay,
  });
  const result = await send({
    to,
    cc,
    subject: mail.subject,
    text: mail.text,
    fromName: args.merchant.name,
    replyTo: args.merchant.replyTo ?? undefined,
  });
  const status = result.sent ? "sent" : result.skipped ? "skipped" : "failed";
  const { error } = await client.from("udpay_mail_logs").insert({
    merchant_id: args.merchant.id,
    kind: "card_registration",
    customer_id: args.customer.id,
    to_addrs: to,
    cc_addrs: cc,
    subject: mail.subject,
    status,
    provider_id: result.id ?? null,
    error: result.error ?? null,
    sent_by: args.sentBy,
  });
  if (error) throw new Error(`送付履歴の記録に失敗: ${error.message}`);
  return { status, error: result.error };
}
