import { sendEmail } from "@/lib/email/send";
import { cardExpiryStatus } from "@/lib/payment/card-expiry";
import { buildInvoiceMail, canCancelConfirmation, chargeDateFor, computeTotals, effectiveChargeDate } from "../logic";
import { getCustomer, type ProdCustomer } from "./customers";
import { getUdpayMerchant } from "./merchants";
import type { SendFn } from "./mail";
import { getLines, getOwnInvoice, type BillingCtx, type Result } from "./invoices";

/**
 * UD Payment（本番）の一括実行（承認者）と決済確定の取消。
 * 一括実行 = 課金予約（submitted）→ 決済確定（approved）＋ 請求メール送付 ＋ 課金予定（udpay_payments）。
 * 実際の課金は課金日の朝の自動処理（charge.ts）で行う。
 */

/** 一括実行で決済確定できない理由（できるなら null） */
export function confirmBlockReason(
  args: { status: string; submittedBy: string | null; total: number },
  customer: Pick<ProdCustomer, "usenMemberId" | "cardExpireYm"> | null,
  approverId: string,
  today: string,
): string | null {
  if (args.status !== "submitted") return "課金予約ではありません";
  if (!customer) return "顧客が見つかりません";
  if (!customer.usenMemberId) return "カード未登録";
  if (cardExpiryStatus(customer.cardExpireYm, today) === "expired") return "カード期限切れ";
  if (args.total <= 0) return "請求合計が0円以下";
  if (args.submittedBy === approverId) return "課金予約した本人は実行できません（作成者と承認者は別の方）";
  return null;
}

/** 請求メールを顧客の To/CC へ送り、送付履歴に残す */
async function sendInvoiceMail(
  ctx: BillingCtx,
  args: { invoiceId: string; customer: ProdCustomer; merchantName: string; replyTo: string | null; month: string; chargeDate: string; subject: string | null; comment: string | null },
  send: SendFn,
): Promise<"sent" | "skipped" | "failed"> {
  const lines = await getLines(ctx.client, args.invoiceId);
  const total = computeTotals(lines.map((l) => ({ ...l, id: "" }))).total;
  const mail = buildInvoiceMail({
    customerName: args.customer.name,
    contactName: args.customer.contactName ?? "",
    month: args.month,
    total,
    chargeDate: args.chargeDate,
    lines: lines.map((l) => ({ ...l, id: "" })),
    subject: args.subject ?? undefined,
    comment: args.comment ?? undefined,
  });
  const to = args.customer.contacts.filter((c) => c.kind === "to").map((c) => c.email);
  const cc = args.customer.contacts.filter((c) => c.kind === "cc").map((c) => c.email);
  const result = await send({
    to,
    cc,
    subject: mail.subject,
    text: mail.body,
    fromName: args.merchantName,
    replyTo: args.replyTo ?? undefined,
  });
  const status = result.sent ? "sent" : result.skipped ? "skipped" : "failed";
  await ctx.client.from("udpay_mail_logs").insert({
    merchant_id: ctx.member.merchantId,
    kind: "invoice",
    customer_id: args.customer.id,
    invoice_id: args.invoiceId,
    to_addrs: to,
    cc_addrs: cc,
    subject: mail.subject,
    status,
    provider_id: result.id ?? null,
    error: result.error ?? null,
    sent_by: ctx.member.userId,
  });
  return status;
}

/**
 * 一括実行（承認者のみ）。選ばれた課金予約を決済確定し、請求メールを送り、課金を予定する。
 * 課金日は顧客の決済日（予定日を過ぎていれば翌日）。決済確定は条件付き UPDATE で1回だけ成立する。
 */
export async function confirmInvoices(
  ctx: BillingCtx,
  invoiceIds: string[],
  send: SendFn = sendEmail,
): Promise<{ confirmed: number; skipped: { invoiceId: string; reason: string }[]; mailFailed: number }> {
  const skipped: { invoiceId: string; reason: string }[] = [];
  if (!ctx.member.isApprover) {
    return { confirmed: 0, skipped: invoiceIds.map((id) => ({ invoiceId: id, reason: "承認者のみ実行できます" })), mailFailed: 0 };
  }
  const merchant = await getUdpayMerchant(ctx.client, ctx.member.merchantId);
  let confirmed = 0;
  let mailFailed = 0;
  for (const id of invoiceIds) {
    const inv = await getOwnInvoice(ctx, id);
    const customer = inv ? await getCustomer(ctx.client, inv.customer_id) : null;
    const reason = inv
      ? confirmBlockReason({ status: inv.status, submittedBy: inv.submitted_by, total: Number(inv.total) }, customer, ctx.member.userId, ctx.today)
      : "請求書が見つかりません";
    if (!inv || !customer || reason) {
      skipped.push({ invoiceId: id, reason: reason ?? "請求書が見つかりません" });
      continue;
    }
    const now = new Date().toISOString();
    const { data: done, error } = await ctx.client
      .from("udpay_invoices")
      .update({ status: "approved", approved_by: ctx.member.userId, approved_at: now })
      .eq("id", id)
      .eq("status", "submitted")
      .select("mail_subject, mail_comment");
    if (error || !done?.length) {
      skipped.push({ invoiceId: id, reason: error?.message ?? "他の操作と重なりました" });
      continue;
    }
    const chargeDate = effectiveChargeDate(chargeDateFor(inv.service_month, customer.chargeDay ?? 15), ctx.today);
    // 1請求＝1決済（invoice_id 一意）。決済確定の取消で cancelled になった行は課金予定に戻して使い回す
    const pay = await ctx.client.from("udpay_payments").upsert(
      {
        merchant_id: ctx.member.merchantId,
        invoice_id: id,
        customer_id: customer.id,
        amount: Number(inv.total),
        scheduled_date: chargeDate,
        status: "scheduled",
        last_error_code: null,
        last_error_message: null,
        cancelled_at: null,
      },
      { onConflict: "invoice_id" },
    );
    if (pay.error) throw new Error(`課金予定の作成に失敗: ${pay.error.message}`);
    const mailStatus = await sendInvoiceMail(
      ctx,
      {
        invoiceId: id,
        customer,
        merchantName: merchant?.name ?? "",
        replyTo: merchant?.replyTo ?? null,
        month: inv.service_month,
        chargeDate,
        subject: (done[0].mail_subject as string | null) ?? null,
        comment: (done[0].mail_comment as string | null) ?? null,
      },
      send,
    );
    if (mailStatus === "failed") mailFailed++;
    await ctx.client.from("udpay_invoices").update({ mail_sent_at: mailStatus === "failed" ? null : now }).eq("id", id);
    confirmed++;
  }
  return { confirmed, skipped, mailFailed };
}

/**
 * 決済確定を取り消して課金予約に戻す（課金日の前日まで）。
 * 請求メールは送付済みのため、画面で訂正メールを案内する（confirmation_cancelled_at）。
 */
export async function cancelConfirmation(ctx: BillingCtx, invoiceId: string): Promise<Result> {
  const inv = await getOwnInvoice(ctx, invoiceId);
  if (!inv || inv.status !== "approved") return { ok: false, error: "課金前の決済確定のみ取り消せます" };
  const { data: pay } = await ctx.client
    .from("udpay_payments")
    .select("id, status, scheduled_date")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (!pay || pay.status !== "scheduled") return { ok: false, error: "課金前の決済確定のみ取り消せます" };
  if (!canCancelConfirmation(pay.scheduled_date as string, ctx.today)) {
    return { ok: false, error: "課金日の当日以降は取り消せません（UDへ取消・返品をご依頼ください）" };
  }
  const now = new Date().toISOString();
  const lock = await ctx.client
    .from("udpay_payments")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", pay.id)
    .eq("status", "scheduled")
    .select("id");
  if (lock.error || !lock.data?.length) return { ok: false, error: "課金処理が始まっているため取り消せません" };
  const upd = await ctx.client
    .from("udpay_invoices")
    .update({ status: "submitted", approved_by: null, approved_at: null, confirmation_cancelled_at: now })
    .eq("id", invoiceId)
    .eq("status", "approved");
  if (upd.error) return { ok: false, error: upd.error.message };
  return { ok: true };
}
