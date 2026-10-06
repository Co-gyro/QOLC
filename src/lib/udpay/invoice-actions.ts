import { randomUUID } from "node:crypto";
import type { UdpayInvoice, UdpayInvoiceLine, UdpayStore } from "./types";
import {
  canCancelConfirmation,
  chargeDateFor,
  computeTotals,
  effectiveChargeDate,
  todayJst,
} from "./logic";
import { cardExpiryStatus } from "@/lib/payment/card-expiry";
import type { CsvMatchedGroup } from "./csv-import";
import { loadStore, saveStore } from "./store";

/**
 * UD Payment デモの請求・課金操作。
 * 状態の流れ: 下書き → 課金予約（担当者）→ 決済確定（承認者の一括実行・メール送付）
 * → 決済日に自動課金 → 入金済み／与信落ち。
 */

/** 操作結果（失敗時は理由を返す） */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** 新しい明細行ID */
function lineId(): string {
  return `line-${randomUUID().slice(0, 8)}`;
}

/** 顧客ごとに、指定月より前の直近の請求を返す（数か月に1回の顧客も拾う） */
function latestInvoiceBefore(
  store: UdpayStore,
  customerId: string,
  month: string,
): UdpayInvoice | undefined {
  return store.invoices
    .filter((i) => i.customerId === customerId && i.month < month)
    .sort((a, b) => b.month.localeCompare(a.month))[0];
}

/**
 * 各顧客の直近の請求を指定月へコピーして下書きを作る。
 * 指定月の請求が既にある顧客はスキップし、作成件数を返す。
 */
export async function copyLatestInvoices(month: string): Promise<number> {
  const store = await loadStore();
  let created = 0;
  for (const customer of store.customers) {
    if (store.invoices.some((i) => i.month === month && i.customerId === customer.id)) continue;
    const source = latestInvoiceBefore(store, customer.id, month);
    if (!source) continue;
    store.invoices.push({
      id: `inv-${randomUUID().slice(0, 8)}`,
      customerId: customer.id,
      month,
      lines: source.lines.map((l) => ({ ...l, id: lineId() })),
      status: "draft",
    });
    created++;
  }
  await saveStore(store);
  return created;
}

/** 請求書（下書き）を新規作成する。同じ顧客・同じ月の請求は1件まで */
export async function createInvoice(
  customerId: string,
  month: string,
): Promise<{ ok: true; invoice: UdpayInvoice } | { ok: false; error: string }> {
  const store = await loadStore();
  if (store.invoices.some((i) => i.customerId === customerId && i.month === month)) {
    return { ok: false, error: "この顧客のこの月の請求は既にあります（同じ月の請求は1件にまとめます）" };
  }
  const invoice: UdpayInvoice = {
    id: `inv-${randomUUID().slice(0, 8)}`,
    customerId,
    month,
    lines: [],
    status: "draft",
  };
  store.invoices.push(invoice);
  await saveStore(store);
  return { ok: true, invoice };
}

/** 請求書の明細行を更新する（下書きのみ） */
export async function updateInvoiceLines(
  invoiceId: string,
  lines: Omit<UdpayInvoiceLine, "id">[],
): Promise<ActionResult> {
  const store = await loadStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "draft") {
    return { ok: false, error: "下書きのみ編集できます（課金予約中は「下書きに戻す」してください）" };
  }
  inv.lines = lines.map((l) => ({ ...l, id: lineId() }));
  await saveStore(store);
  return { ok: true };
}

/** 請求メールの件名・追記コメントを保存する（決済確定前のみ） */
export async function updateInvoiceMail(
  invoiceId: string,
  mail: { subject?: string; comment?: string },
): Promise<ActionResult> {
  const store = await loadStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status === "confirmed") return { ok: false, error: "メール送付済みのため編集できません" };
  inv.mailSubject = mail.subject?.trim() || undefined;
  inv.mailComment = mail.comment?.trim() || undefined;
  await saveStore(store);
  return { ok: true };
}

/** 課金予約できない理由（できるなら null） */
function reserveBlocker(inv: UdpayInvoice): string | null {
  if (inv.status !== "draft") return "下書きではありません";
  if (inv.lines.length === 0) return "明細行がありません";
  if (computeTotals(inv.lines).total <= 0) return "請求合計が0円以下のため課金予約できません";
  return null;
}

/**
 * 請求を課金予約にする（担当者の操作・メールは送らない）。複数件まとめて実行できる。
 */
export async function reserveInvoices(
  invoiceIds: string[],
): Promise<{ reserved: number; errors: { invoiceId: string; error: string }[] }> {
  const store = await loadStore();
  const now = new Date().toISOString();
  const errors: { invoiceId: string; error: string }[] = [];
  let reserved = 0;
  for (const id of invoiceIds) {
    const inv = store.invoices.find((i) => i.id === id);
    const blocker = inv ? reserveBlocker(inv) : "請求書が見つかりません";
    if (!inv || blocker) {
      errors.push({ invoiceId: id, error: blocker ?? "請求書が見つかりません" });
      continue;
    }
    inv.status = "reserved";
    inv.reservedAt = now;
    reserved++;
  }
  await saveStore(store);
  return { reserved, errors };
}

/** 課金予約を下書きに戻す（要望7） */
export async function revertToDraft(invoiceId: string): Promise<ActionResult> {
  const store = await loadStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "reserved") return { ok: false, error: "課金予約の請求のみ下書きに戻せます" };
  inv.status = "draft";
  inv.reservedAt = undefined;
  await saveStore(store);
  return { ok: true };
}

/**
 * 一括実行で決済確定できない理由（できるなら null）。確認画面の「対象外」表示にも使う。
 */
export function confirmBlocker(store: UdpayStore, inv: UdpayInvoice, today: string): string | null {
  if (inv.status !== "reserved") return "課金予約ではありません";
  const customer = store.customers.find((c) => c.id === inv.customerId);
  if (!customer) return "顧客が見つかりません";
  if (!customer.card.registered) return "カード未登録";
  if (cardExpiryStatus(customer.card.expireYm, today) === "expired") return "カード期限切れ";
  if (computeTotals(inv.lines).total <= 0) return "請求合計が0円以下";
  return null;
}

/**
 * 一括実行（要望6）: 課金予約の請求を決済確定にし、請求メールを送付して課金を予約する。
 * 課金日は各顧客の決済日。予定日を過ぎている場合は翌日（翌朝の自動処理）に課金する。
 */
export async function confirmInvoices(
  invoiceIds: string[],
  today: string = todayJst(),
): Promise<{ confirmed: number; skipped: { invoiceId: string; reason: string }[] }> {
  const store = await loadStore();
  const now = new Date().toISOString();
  const skipped: { invoiceId: string; reason: string }[] = [];
  let confirmed = 0;
  for (const id of invoiceIds) {
    const inv = store.invoices.find((i) => i.id === id);
    const reason = inv ? confirmBlocker(store, inv, today) : "請求書が見つかりません";
    if (!inv || reason) {
      skipped.push({ invoiceId: id, reason: reason ?? "請求書が見つかりません" });
      continue;
    }
    const customer = store.customers.find((c) => c.id === inv.customerId);
    const planned = chargeDateFor(inv.month, customer?.anniversaryDay ?? 1);
    inv.status = "confirmed";
    inv.confirmedAt = now;
    inv.mailSentAt = now;
    store.payments.push({
      id: `pay-${randomUUID().slice(0, 8)}`,
      invoiceId: inv.id,
      customerId: inv.customerId,
      amount: computeTotals(inv.lines).total,
      scheduledDate: effectiveChargeDate(planned, today),
      status: "scheduled",
      attempts: [],
    });
    confirmed++;
  }
  await saveStore(store);
  return { confirmed, skipped };
}

/**
 * 決済確定を取り消して課金予約に戻す（課金日の前日まで）。
 * メールは送付済みのため、訂正メールの案内を画面に出す（confirmationCancelledAt）。
 */
export async function cancelConfirmation(
  invoiceId: string,
  today: string = todayJst(),
): Promise<ActionResult> {
  const store = await loadStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  const payment = store.payments.find((p) => p.invoiceId === invoiceId);
  if (!inv || !payment) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "confirmed" || payment.status !== "scheduled") {
    return { ok: false, error: "課金前の決済確定のみ取り消せます" };
  }
  if (!canCancelConfirmation(payment.scheduledDate, today)) {
    return { ok: false, error: "課金日の当日以降は取り消せません（UDへ取消・返品をご依頼ください）" };
  }
  store.payments = store.payments.filter((p) => p.id !== payment.id);
  inv.status = "reserved";
  inv.confirmationCancelledAt = new Date().toISOString();
  await saveStore(store);
  return { ok: true };
}

/**
 * CSV一括取込: 顧客ごとの明細グループを指定月の請求書（下書き）へ反映する。
 * 既存の下書きは明細を差し替え、無ければ新規作成。課金予約・決済確定はスキップする。
 */
export async function importInvoiceLines(
  month: string,
  groups: CsvMatchedGroup[],
): Promise<{ created: number; updated: number; skippedConfirmed: string[] }> {
  const store = await loadStore();
  let created = 0;
  let updated = 0;
  const skippedConfirmed: string[] = [];
  for (const group of groups) {
    const lines = group.lines.map((l) => ({ ...l, id: lineId() }));
    const existing = store.invoices.find(
      (i) => i.month === month && i.customerId === group.customerId,
    );
    if (existing && existing.status !== "draft") {
      skippedConfirmed.push(group.customerName);
      continue;
    }
    if (existing) {
      existing.lines = lines;
      updated++;
    } else {
      store.invoices.push({
        id: `inv-${randomUUID().slice(0, 8)}`,
        customerId: group.customerId,
        month,
        lines,
        status: "draft",
      });
      created++;
    }
  }
  await saveStore(store);
  return { created, updated, skippedConfirmed };
}
