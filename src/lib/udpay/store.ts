import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  UdpayCustomer,
  UdpayInvoice,
  UdpayInvoiceLine,
  UdpayPayment,
  UdpayStore,
} from "./types";
import {
  chargeDateFor,
  computeTotals,
  detectBrand,
  maskCardNumber,
  previousMonth,
  validateCardNumber,
} from "./logic";
import { buildSeed, SEED_VERSION } from "./seed";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * UD Payment（仮）デモのストア。
 * - 本番（Vercel常設デモ）: 環境変数 UDPAY_STORE=supabase で
 *   udpay_demo_store テーブルの1行（id='main'）に JSONB 保存
 * - ローカル/テスト: リポジトリ直下 .udpay-demo/store.json（UDPAY_STORE_DIR で差し替え可）
 * 排他制御は last-writer-wins（デモ専用のため許容。実装簡素化を優先）。
 */

const ROW_ID = "main";

function isSupabaseBackend(): boolean {
  return process.env.UDPAY_STORE === "supabase";
}

/** ファイルストアの保存先（テストでは UDPAY_STORE_DIR で差し替える） */
function storeDir(): string {
  return process.env.UDPAY_STORE_DIR ?? path.resolve(process.cwd(), ".udpay-demo");
}

function storePath(): string {
  return path.join(storeDir(), "store.json");
}

/** ストアを読み込む。存在しない or シード構造が古い場合はシードし直す */
export async function loadStore(): Promise<UdpayStore> {
  if (isSupabaseBackend()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("udpay_demo_store")
      .select("data, seed_version")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (!error && data && data.seed_version === SEED_VERSION) {
      return data.data as UdpayStore;
    }
    return resetStore();
  }
  try {
    const raw = fs.readFileSync(storePath(), "utf-8");
    const store = JSON.parse(raw) as UdpayStore;
    if (store.seedVersion === SEED_VERSION) return store;
  } catch {
    // 初回 or 壊れている場合はシードへフォールバック
  }
  return resetStore();
}

/** ストアを書き込む */
export async function saveStore(store: UdpayStore): Promise<void> {
  if (isSupabaseBackend()) {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("udpay_demo_store").upsert({
      id: ROW_ID,
      data: store,
      seed_version: store.seedVersion,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`udpay_demo_store の保存に失敗: ${error.message}`);
    return;
  }
  fs.mkdirSync(storeDir(), { recursive: true });
  const tmp = `${storePath()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf-8");
  fs.renameSync(tmp, storePath());
}

/** デモデータを初期状態に戻す */
export async function resetStore(): Promise<UdpayStore> {
  const seed = buildSeed();
  await saveStore(seed);
  return seed;
}

/** 顧客を追加し、カード登録リンク用トークンを発行する */
export async function createCustomer(input: {
  name: string;
  contactName: string;
  email: string;
  anniversaryDay: number;
}): Promise<UdpayCustomer> {
  const store = await loadStore();
  const customer: UdpayCustomer = {
    id: `cust-${randomUUID().slice(0, 8)}`,
    name: input.name,
    contactName: input.contactName,
    email: input.email,
    anniversaryDay: input.anniversaryDay,
    registrationToken: randomUUID().slice(0, 13),
    card: { registered: false },
    createdAt: new Date().toISOString(),
  };
  store.customers.push(customer);
  await saveStore(store);
  return customer;
}

/** カード登録リンクのトークンからカードを登録する（デモ: マスク済み番号のみ保存） */
export async function registerCardByToken(
  token: string,
  cardNumber: string,
): Promise<{ ok: true; customer: UdpayCustomer } | { ok: false; error: string }> {
  if (!validateCardNumber(cardNumber)) {
    return { ok: false, error: "カード番号の形式が正しくありません" };
  }
  const store = await loadStore();
  const customer = store.customers.find((c) => c.registrationToken === token);
  if (!customer) return { ok: false, error: "登録リンクが無効です" };
  customer.card = {
    registered: true,
    maskedNumber: maskCardNumber(cardNumber),
    brand: detectBrand(cardNumber),
    registeredAt: new Date().toISOString(),
  };
  await saveStore(store);
  return { ok: true, customer };
}

/**
 * 前月の請求書を当月へコピーして下書きを作る。
 * 当月分が既にある顧客はスキップし、作成件数を返す。
 */
export async function copyPreviousMonthInvoices(month: string): Promise<number> {
  const store = await loadStore();
  const prev = previousMonth(month);
  let created = 0;
  for (const prevInv of store.invoices.filter((i) => i.month === prev)) {
    const exists = store.invoices.some(
      (i) => i.month === month && i.customerId === prevInv.customerId,
    );
    if (exists) continue;
    store.invoices.push({
      id: `inv-${randomUUID().slice(0, 8)}`,
      customerId: prevInv.customerId,
      month,
      lines: prevInv.lines.map((l) => ({ ...l, id: `line-${randomUUID().slice(0, 8)}` })),
      status: "draft",
    });
    created++;
  }
  await saveStore(store);
  return created;
}

/** 請求書（下書き）を新規作成する */
export async function createInvoice(
  customerId: string,
  month: string,
): Promise<UdpayInvoice> {
  const store = await loadStore();
  const inv: UdpayInvoice = {
    id: `inv-${randomUUID().slice(0, 8)}`,
    customerId,
    month,
    lines: [],
    status: "draft",
  };
  store.invoices.push(inv);
  await saveStore(store);
  return inv;
}

/** 請求書の明細行を更新する（下書きのみ） */
export async function updateInvoiceLines(
  invoiceId: string,
  lines: Omit<UdpayInvoiceLine, "id">[],
): Promise<{ ok: boolean; error?: string }> {
  const store = await loadStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "draft") return { ok: false, error: "確定済みの請求書は編集できません" };
  inv.lines = lines.map((l) => ({ ...l, id: `line-${randomUUID().slice(0, 8)}` }));
  await saveStore(store);
  return { ok: true };
}

/**
 * 請求書を確定する。
 * 確定と同時に請求明細メールを送信済みとし、アニバーサリー日で課金をスケジュールする。
 */
export async function confirmInvoice(
  invoiceId: string,
): Promise<{ ok: true; payment: UdpayPayment } | { ok: false; error: string }> {
  const store = await loadStore();
  const inv = store.invoices.find((i) => i.id === invoiceId);
  if (!inv) return { ok: false, error: "請求書が見つかりません" };
  if (inv.status !== "draft") return { ok: false, error: "既に確定済みです" };
  if (inv.lines.length === 0) return { ok: false, error: "明細行がありません" };
  const customer = store.customers.find((c) => c.id === inv.customerId);
  if (!customer) return { ok: false, error: "顧客が見つかりません" };
  if (!customer.card.registered) {
    return { ok: false, error: "カード未登録のため確定できません（登録リンクを送付してください）" };
  }
  const now = new Date().toISOString();
  inv.status = "confirmed";
  inv.confirmedAt = now;
  inv.mailSentAt = now;
  const payment: UdpayPayment = {
    id: `pay-${randomUUID().slice(0, 8)}`,
    invoiceId: inv.id,
    customerId: inv.customerId,
    amount: computeTotals(inv.lines).total,
    scheduledDate: chargeDateFor(inv.month, customer.anniversaryDay),
    status: "scheduled",
    attempts: [],
  };
  store.payments.push(payment);
  await saveStore(store);
  return { ok: true, payment };
}

/**
 * 課金バッチを実行する（デモ: 予定日を待たず、scheduled 全件を課金する）。
 * demoFailOnce フラグ付きの顧客は一度だけ与信落ち（do_not_honor）させる。
 */
export async function runChargeBatch(): Promise<{ paid: number; failed: number }> {
  const store = await loadStore();
  const now = new Date().toISOString();
  let paid = 0;
  let failed = 0;
  for (const payment of store.payments.filter((p) => p.status === "scheduled")) {
    const customer = store.customers.find((c) => c.id === payment.customerId);
    if (customer?.card.demoFailOnce) {
      customer.card.demoFailOnce = false;
      payment.status = "failed";
      payment.attempts.push({ at: now, result: "failed", reason: "do_not_honor" });
      failed++;
    } else {
      payment.status = "paid";
      payment.paidAt = now;
      payment.attempts.push({ at: now, result: "paid" });
      paid++;
    }
  }
  await saveStore(store);
  return { paid, failed };
}

/** 失敗した課金を再試行する（デモ: 再試行は成功する） */
export async function retryPayment(
  paymentId: string,
): Promise<{ ok: boolean; error?: string }> {
  const store = await loadStore();
  const payment = store.payments.find((p) => p.id === paymentId);
  if (!payment) return { ok: false, error: "決済が見つかりません" };
  if (payment.status !== "failed") return { ok: false, error: "失敗状態の決済のみ再試行できます" };
  const now = new Date().toISOString();
  payment.status = "paid";
  payment.paidAt = now;
  payment.attempts.push({ at: now, result: "paid" });
  await saveStore(store);
  return { ok: true };
}
