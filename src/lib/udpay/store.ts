import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { UdpayCustomer, UdpayStore } from "./types";
import {
  currentMonth,
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

/**
 * 月替わりの鮮度チェック。
 * デモは「前月分の請求がある」前提で動く（前月コピー動線）ため、
 * 実カレンダーの前月に請求が1件もない古いストアは再シードする。
 */
function isStale(store: UdpayStore): boolean {
  const prev = previousMonth(currentMonth());
  return !store.invoices.some((i) => i.month === prev);
}

/** ストアを読み込む。存在しない・シード構造が古い・月替わりで陳腐化した場合はシードし直す */
export async function loadStore(): Promise<UdpayStore> {
  if (isSupabaseBackend()) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase
      .from("udpay_demo_store")
      .select("data, seed_version")
      .eq("id", ROW_ID)
      .maybeSingle();
    if (!error && data && data.seed_version === SEED_VERSION) {
      const store = data.data as UdpayStore;
      if (!isStale(store)) return store;
    }
    return resetStore();
  }
  try {
    const raw = fs.readFileSync(storePath(), "utf-8");
    const store = JSON.parse(raw) as UdpayStore;
    if (store.seedVersion === SEED_VERSION && !isStale(store)) return store;
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
  cc?: string[];
  anniversaryDay: number;
  note?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
}): Promise<UdpayCustomer> {
  const store = await loadStore();
  const customer: UdpayCustomer = {
    id: `cust-${randomUUID().slice(0, 8)}`,
    name: input.name,
    contactName: input.contactName,
    email: input.email,
    cc: input.cc ?? [],
    anniversaryDay: input.anniversaryDay,
    note: input.note,
    postalCode: input.postalCode,
    address1: input.address1,
    address2: input.address2,
    registrationToken: randomUUID().slice(0, 13),
    card: { registered: false },
    createdAt: new Date().toISOString(),
  };
  store.customers.push(customer);
  await saveStore(store);
  return customer;
}

/** 顧客の登録内容（新規追加・編集で共通の入力） */
export interface CustomerInput {
  name: string;
  contactName: string;
  email: string;
  cc?: string[];
  anniversaryDay: number;
  note?: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
}

/**
 * 顧客の登録内容を編集する（ランサイド様要望 2026-10-08: 登録ミス・担当者変更・メール変更）。
 * カード情報・登録リンクは変えない。決済日の変更は、これから決済確定する請求から反映する
 * （決済確定済みの課金日は変えない）。
 */
export async function updateCustomer(
  customerId: string,
  input: CustomerInput,
): Promise<{ ok: boolean; error?: string }> {
  const store = await loadStore();
  const customer = store.customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, error: "顧客が見つかりません" };
  Object.assign(customer, {
    name: input.name,
    contactName: input.contactName,
    email: input.email,
    cc: input.cc ?? [],
    anniversaryDay: input.anniversaryDay,
    note: input.note,
    postalCode: input.postalCode,
    address1: input.address1,
    address2: input.address2,
  });
  await saveStore(store);
  return { ok: true };
}

/**
 * 有効期限の入力（"MM/YY" または "MM/YYYY"）を "YYYYMM" にする。不正なら null。
 */
export function parseCardExpiry(expiry: string): string | null {
  const m = expiry.trim().match(/^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/);
  if (!m) return null;
  const mm = Number(m[1]);
  if (mm < 1 || mm > 12) return null;
  const yyyy = m[2].length === 2 ? `20${m[2]}` : m[2];
  return `${yyyy}${String(mm).padStart(2, "0")}`;
}

/**
 * カード登録リンクのトークンからカードを登録する（デモ: マスク済み番号と有効期限のみ保存）。
 * 既に登録済みの場合は上書き（カード変更）になる。
 */
export async function registerCardByToken(
  token: string,
  cardNumber: string,
  expiry?: string,
): Promise<{ ok: true; customer: UdpayCustomer } | { ok: false; error: string }> {
  if (!validateCardNumber(cardNumber)) {
    return { ok: false, error: "カード番号の形式が正しくありません" };
  }
  const expireYm = expiry ? parseCardExpiry(expiry) : null;
  if (expiry && !expireYm) {
    return { ok: false, error: "有効期限の形式が正しくありません（例: 12/28）" };
  }
  const store = await loadStore();
  const customer = store.customers.find((c) => c.registrationToken === token);
  if (!customer) return { ok: false, error: "登録リンクが無効です" };
  customer.card = {
    registered: true,
    maskedNumber: maskCardNumber(cardNumber),
    brand: detectBrand(cardNumber),
    expireYm: expireYm ?? undefined,
    registeredAt: new Date().toISOString(),
  };
  await saveStore(store);
  return { ok: true, customer };
}

/** カード登録リンクをメールで送った記録を残す（デモ: 実際には送信しない） */
export async function markRegistrationMailSent(
  customerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const store = await loadStore();
  const customer = store.customers.find((c) => c.id === customerId);
  if (!customer) return { ok: false, error: "顧客が見つかりません" };
  customer.registrationMailSentAt = new Date().toISOString();
  await saveStore(store);
  return { ok: true };
}
