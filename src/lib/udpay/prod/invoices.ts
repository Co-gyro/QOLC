import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTotals } from "../logic";
import type { UdpayInvoiceLine } from "../types";
import type { BillingMember } from "./member";

/**
 * UD Payment（本番）の請求の作成・編集・課金予約（担当者の操作）。
 * 状態: draft=下書き → submitted=課金予約 → approved=決済確定（confirm.ts）。
 * すべての操作は加盟店（member.merchantId）の請求に限る。
 */

/** 操作の文脈 */
export interface BillingCtx {
  client: SupabaseClient;
  member: BillingMember;
  /** 今日（日本時間 YYYY-MM-DD） */
  today: string;
}

/** 操作結果 */
export type Result = { ok: true } | { ok: false; error: string };

/** 請求の行（必要な列だけ） */
export interface InvoiceRecord {
  id: string;
  merchant_id: string;
  customer_id: string;
  service_month: string;
  status: string;
  submitted_by: string | null;
  total: number;
}

/** 明細（税抜単価） */
type LineInput = Omit<UdpayInvoiceLine, "id">;

/** 自社の請求を1件読む（他社の請求は見つからない扱い） */
export async function getOwnInvoice(ctx: BillingCtx, id: string): Promise<InvoiceRecord | null> {
  const { data } = await ctx.client
    .from("udpay_invoices")
    .select("id, merchant_id, customer_id, service_month, status, submitted_by, total")
    .eq("id", id)
    .eq("merchant_id", ctx.member.merchantId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as InvoiceRecord | null) ?? null;
}

/** 請求の明細を読む */
export async function getLines(client: SupabaseClient, invoiceId: string): Promise<LineInput[]> {
  const { data, error } = await client
    .from("udpay_invoice_lines")
    .select("description, quantity, unit_price, tax_rate")
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null)
    .order("sort");
  if (error) throw new Error(`明細の取得に失敗: ${error.message}`);
  return (data ?? []).map((l) => ({
    description: l.description as string,
    quantity: l.quantity as number,
    unitPrice: Number(l.unit_price),
    taxRate: l.tax_rate as number,
  }));
}

/** 明細を差し替え、合計を保存する（既存の明細はソフトデリート） */
async function replaceLines(ctx: BillingCtx, invoiceId: string, lines: LineInput[]): Promise<void> {
  const now = new Date().toISOString();
  const del = await ctx.client
    .from("udpay_invoice_lines")
    .update({ deleted_at: now })
    .eq("invoice_id", invoiceId)
    .is("deleted_at", null);
  if (del.error) throw new Error(`明細の更新に失敗: ${del.error.message}`);
  if (lines.length > 0) {
    const ins = await ctx.client.from("udpay_invoice_lines").insert(
      lines.map((l, i) => ({
        invoice_id: invoiceId,
        sort: i,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        tax_rate: l.taxRate,
      })),
    );
    if (ins.error) throw new Error(`明細の登録に失敗: ${ins.error.message}`);
  }
  const t = computeTotals(lines.map((l) => ({ ...l, id: "" })));
  const upd = await ctx.client
    .from("udpay_invoices")
    .update({ subtotal: t.subtotal, tax: t.tax, total: t.total })
    .eq("id", invoiceId);
  if (upd.error) throw new Error(`合計の保存に失敗: ${upd.error.message}`);
}

/** 自社の顧客か */
async function ownCustomer(ctx: BillingCtx, customerId: string): Promise<boolean> {
  const { data } = await ctx.client
    .from("udpay_customers")
    .select("id")
    .eq("id", customerId)
    .eq("merchant_id", ctx.member.merchantId)
    .is("deleted_at", null)
    .maybeSingle();
  return Boolean(data);
}

/** 請求（下書き）を作る。同じ顧客・同じ月の請求は1件まで（DB の一意索引） */
export async function createDraft(
  ctx: BillingCtx,
  customerId: string,
  month: string,
  lines: LineInput[] = [],
): Promise<{ ok: true; invoice: { id: string } } | { ok: false; error: string }> {
  if (!(await ownCustomer(ctx, customerId))) return { ok: false, error: "顧客が見つかりません" };
  const { data, error } = await ctx.client
    .from("udpay_invoices")
    .insert({
      merchant_id: ctx.member.merchantId,
      customer_id: customerId,
      service_month: month,
      status: "draft",
      created_by: ctx.member.userId,
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    return { ok: false, error: "この顧客のこの月の請求は既にあります（同じ月の請求は1件にまとめます）" };
  }
  if (error || !data) return { ok: false, error: `請求の作成に失敗: ${error?.message ?? "不明"}` };
  if (lines.length > 0) await replaceLines(ctx, data.id as string, lines);
  return { ok: true, invoice: { id: data.id as string } };
}

/** 各顧客の直近の請求（指定月より前）を指定月へコピーして下書きを作る。作成件数を返す */
export async function copyLatestInvoices(ctx: BillingCtx, month: string): Promise<number> {
  const { data } = await ctx.client
    .from("udpay_invoices")
    .select("id, customer_id, service_month")
    .eq("merchant_id", ctx.member.merchantId)
    .is("deleted_at", null)
    .neq("status", "cancelled")
    .lte("service_month", month)
    .order("service_month", { ascending: false });
  const all = (data ?? []) as { id: string; customer_id: string; service_month: string }[];
  const hasMonth = new Set(all.filter((i) => i.service_month === month).map((i) => i.customer_id));
  const latest = new Map<string, string>();
  for (const i of all) {
    if (i.service_month < month && !hasMonth.has(i.customer_id) && !latest.has(i.customer_id)) latest.set(i.customer_id, i.id);
  }
  let created = 0;
  for (const [customerId, sourceId] of Array.from(latest.entries())) {
    const r = await createDraft(ctx, customerId, month, await getLines(ctx.client, sourceId));
    if (r.ok) created++;
  }
  return created;
}

/** 明細を更新する（下書きのみ） */
export async function updateLines(ctx: BillingCtx, invoiceId: string, lines: LineInput[]): Promise<Result> {
  const inv = await getOwnInvoice(ctx, invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "draft") {
    return { ok: false, error: "下書きのみ編集できます（課金予約中は「下書きに戻す」してください）" };
  }
  await replaceLines(ctx, invoiceId, lines);
  return { ok: true };
}

/** メールの件名・追記コメントを保存する（決済確定前のみ） */
export async function updateMail(
  ctx: BillingCtx,
  invoiceId: string,
  mail: { subject?: string; comment?: string },
): Promise<Result> {
  const inv = await getOwnInvoice(ctx, invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "draft" && inv.status !== "submitted") {
    return { ok: false, error: "メール送付済みのため編集できません" };
  }
  const { error } = await ctx.client
    .from("udpay_invoices")
    .update({ mail_subject: mail.subject?.trim() || null, mail_comment: mail.comment?.trim() || null })
    .eq("id", invoiceId);
  return error ? { ok: false, error: `保存に失敗: ${error.message}` } : { ok: true };
}

/** 課金予約（担当者。メールは送らない）。複数件まとめて行える */
export async function reserve(
  ctx: BillingCtx,
  invoiceIds: string[],
): Promise<{ reserved: number; errors: { invoiceId: string; error: string }[] }> {
  const errors: { invoiceId: string; error: string }[] = [];
  let reserved = 0;
  for (const id of invoiceIds) {
    const inv = await getOwnInvoice(ctx, id);
    if (!inv || inv.status !== "draft") {
      errors.push({ invoiceId: id, error: inv ? "下書きではありません" : "請求書が見つかりません" });
      continue;
    }
    const lines = await getLines(ctx.client, id);
    const t = computeTotals(lines.map((l) => ({ ...l, id: "" })));
    if (lines.length === 0 || t.total <= 0) {
      errors.push({ invoiceId: id, error: lines.length === 0 ? "明細行がありません" : "請求合計が0円以下のため課金予約できません" });
      continue;
    }
    const { data, error } = await ctx.client
      .from("udpay_invoices")
      .update({
        status: "submitted",
        submitted_by: ctx.member.userId,
        submitted_at: new Date().toISOString(),
        subtotal: t.subtotal,
        tax: t.tax,
        total: t.total,
      })
      .eq("id", id)
      .eq("status", "draft")
      .select("id");
    if (error || !data?.length) {
      errors.push({ invoiceId: id, error: error?.message ?? "他の操作と重なりました。画面を更新してください" });
      continue;
    }
    reserved++;
  }
  return { reserved, errors };
}

/** 課金予約を下書きに戻す */
export async function revertToDraft(ctx: BillingCtx, invoiceId: string): Promise<Result> {
  const inv = await getOwnInvoice(ctx, invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "submitted") return { ok: false, error: "課金予約の請求のみ下書きに戻せます" };
  const { data, error } = await ctx.client
    .from("udpay_invoices")
    .update({ status: "draft", submitted_by: null, submitted_at: null })
    .eq("id", invoiceId)
    .eq("status", "submitted")
    .select("id");
  if (error || !data?.length) return { ok: false, error: error?.message ?? "他の操作と重なりました" };
  return { ok: true };
}

/**
 * CSV取込: 顧客ごとの明細を指定月の請求（下書き）へ反映する。
 * 下書きは明細を差し替え、無ければ作る。課金予約以降の請求は変えない。
 */
export async function importLines(
  ctx: BillingCtx,
  month: string,
  groups: { customerId: string; customerName: string; lines: LineInput[] }[],
): Promise<{ created: number; updated: number; skippedConfirmed: string[] }> {
  let created = 0;
  let updated = 0;
  const skippedConfirmed: string[] = [];
  for (const g of groups) {
    const { data } = await ctx.client
      .from("udpay_invoices")
      .select("id, status")
      .eq("merchant_id", ctx.member.merchantId)
      .eq("customer_id", g.customerId)
      .eq("service_month", month)
      .is("deleted_at", null)
      .neq("status", "cancelled")
      .maybeSingle();
    if (data && data.status !== "draft") {
      skippedConfirmed.push(g.customerName);
    } else if (data) {
      await replaceLines(ctx, data.id as string, g.lines);
      updated++;
    } else if ((await createDraft(ctx, g.customerId, month, g.lines)).ok) {
      created++;
    }
  }
  return { created, updated, skippedConfirmed };
}
