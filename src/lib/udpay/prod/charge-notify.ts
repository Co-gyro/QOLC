import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email/send";
import { SUPPORT_EMAIL } from "@/lib/email/templates";
import { formatDateJa, formatMonthJa, formatYen } from "../logic";
import type { ChargeOutcome } from "./charge";
import type { SendFn } from "./mail";

/**
 * 毎朝の自動課金の結果のお知らせ（加盟店の利用者全員と UD へ）。
 * 与信落ちは加盟店が顧客へ連絡して「再決済」するきっかけになるため、件数に関係なく必ず送る。
 * 加盟店あての送付は udpay_mail_logs（kind=payment_failed：与信落ちを含む日）に残す。
 */

/** 課金1件の結果 */
export interface ChargeDetail {
  paymentId: string;
  outcome: ChargeOutcome;
  error?: string;
}

/** お知らせに載せる1行 */
export interface NoticeLine {
  customerName: string;
  serviceMonth: string;
  amount: number;
  outcome: ChargeOutcome;
  error?: string;
}

/** 加盟店あてのお知らせ本文を作る */
export function buildChargeNotice(input: { merchantName: string; today: string; lines: NoticeLine[]; billingUrl: string }) {
  const ok = input.lines.filter((l) => l.outcome === "captured");
  const ng = input.lines.filter((l) => l.outcome === "failed");
  const unknown = input.lines.filter((l) => l.outcome === "unknown");
  const row = (l: NoticeLine) => `・${l.customerName}（${formatMonthJa(l.serviceMonth)}分）${formatYen(l.amount)}${l.error ? `　${l.error}` : ""}`;
  const subject = ng.length
    ? `【UD Payment】与信落ちが${ng.length}件あります（${formatDateJa(input.today)}の自動課金）`
    : `【UD Payment】${formatDateJa(input.today)}の自動課金結果（入金済み${ok.length}件）`;
  const parts = [
    `${input.merchantName} ご担当者様`,
    "",
    `${formatDateJa(input.today)}の朝に、決済確定済みの請求を登録カードへ課金しました。`,
    "",
    `■ 入金済み ${ok.length}件・${formatYen(ok.reduce((s, l) => s + l.amount, 0))}`,
    ...ok.map(row),
  ];
  if (ng.length) {
    parts.push("", `■ 与信落ち ${ng.length}件（課金できませんでした）`, ...ng.map(row), "", "お客様へご連絡のうえ、入金管理の「再決済」を押してください。カードを変える場合は、顧客管理から登録リンクをお送りください。");
  }
  if (unknown.length) {
    parts.push("", `■ 確認中 ${unknown.length}件（通信の都合で結果を確認中です。UDで確認してご連絡します）`, ...unknown.map(row));
  }
  parts.push("", `入金管理: ${input.billingUrl}`, "", "※このメールは送信専用アドレスから送信しています。", "UD Payment（株式会社ユニバーサル・デベロップメント）");
  return { subject, text: parts.join("\n") };
}

/** 加盟店の利用者（udpay_members）のメールアドレス */
async function memberEmails(client: SupabaseClient, merchantId: string): Promise<string[]> {
  const { data } = await client.from("udpay_members").select("user_id").eq("merchant_id", merchantId).is("deleted_at", null);
  const emails: string[] = [];
  for (const m of (data ?? []) as { user_id: string }[]) {
    const { data: u } = await client.auth.admin.getUserById(m.user_id);
    // テスト用アカウント（*.test）には送らない
    if (u?.user?.email && !u.user.email.endsWith(".test")) emails.push(u.user.email);
  }
  return emails;
}

/**
 * 自動課金の結果を加盟店ごとにまとめて送る。UD（support@uni-dev.jp）には全加盟店分を1通で送る。
 */
export async function notifyChargeResults(
  client: SupabaseClient,
  details: ChargeDetail[],
  today: string,
  appUrl: string,
  send: SendFn = sendEmail,
): Promise<{ merchants: number; udSent: boolean }> {
  if (details.length === 0) return { merchants: 0, udSent: false };
  const { data } = await client
    .from("udpay_payments")
    .select("id, merchant_id, amount, udpay_customers(name), udpay_invoices(service_month)")
    .in("id", details.map((d) => d.paymentId));
  type Row = { id: string; merchant_id: string; amount: number; udpay_customers: { name: string } | null; udpay_invoices: { service_month: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const byMerchant = new Map<string, NoticeLine[]>();
  for (const d of details) {
    const r = rows.find((x) => x.id === d.paymentId);
    if (!r) continue;
    const list = byMerchant.get(r.merchant_id) ?? [];
    list.push({ customerName: r.udpay_customers?.name ?? "—", serviceMonth: r.udpay_invoices?.service_month ?? "", amount: Number(r.amount), outcome: d.outcome, error: d.error });
    byMerchant.set(r.merchant_id, list);
  }
  const udParts: string[] = [];
  for (const [merchantId, lines] of Array.from(byMerchant.entries())) {
    const { data: m } = await client.from("udpay_merchant_settings").select("display_name, reply_to").eq("merchant_id", merchantId).maybeSingle();
    const merchantName = (m?.display_name as string | null) ?? "加盟店";
    const notice = buildChargeNotice({ merchantName, today, lines, billingUrl: `${appUrl.replace(/\/$/, "")}/billing/payments` });
    const to = Array.from(new Set([...(await memberEmails(client, merchantId)), ...(m?.reply_to ? [m.reply_to as string] : [])]));
    if (to.length) {
      const r = await send({ to, subject: notice.subject, text: notice.text, fromName: "UD Payment" });
      if (lines.some((l) => l.outcome !== "captured")) {
        await client.from("udpay_mail_logs").insert({
          merchant_id: merchantId,
          kind: "payment_failed",
          to_addrs: to,
          subject: notice.subject,
          status: r.sent ? "sent" : r.skipped ? "skipped" : "failed",
          provider_id: r.id ?? null,
          error: r.error ?? null,
        });
      }
    }
    udParts.push(`━━ ${merchantName}（送付先: ${to.join(", ") || "なし"}）━━`, notice.text, "");
  }
  const failedTotal = details.filter((d) => d.outcome !== "captured").length;
  const ud = await send({
    to: SUPPORT_EMAIL,
    subject: `【UD Payment運用】${formatDateJa(today)} 自動課金 ${details.length}件（要対応 ${failedTotal}件）`,
    text: udParts.join("\n"),
    fromName: "UD Payment",
  });
  return { merchants: byMerchant.size, udSent: ud.sent };
}
