import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { newRegistrationToken } from "./identifiers";

/**
 * UD Payment（本番）の顧客リポジトリ。udpay_customers / udpay_customer_contacts を読み書きする。
 * 呼び出し側で権限確認（admin・加盟店メンバー）を済ませ、サービスロールのクライアントを渡す。
 */

/** メール宛先 */
export interface UdpayContact {
  kind: "to" | "cc";
  name: string | null;
  email: string;
}

/** 顧客（本番） */
export interface ProdCustomer {
  id: string;
  merchantId: string;
  name: string;
  contactName: string | null;
  chargeDay: number | null;
  billingNote: string | null;
  internalMemo: string | null;
  postalCode: string | null;
  address1: string | null;
  address2: string | null;
  registrationToken: string;
  usenMemberId: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardExpireYm: string | null;
  cardRegisteredAt: string | null;
  contacts: UdpayContact[];
}

/** 顧客の入力（新規・編集共通）。API の zod 検証にも使う */
export const customerInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  contactName: z.string().trim().max(50).optional().nullable(),
  chargeDay: z.number().int().min(1).max(28),
  billingNote: z.string().max(500).optional().nullable(),
  internalMemo: z.string().max(1000).optional().nullable(),
  postalCode: z.string().regex(/^\d{3}-?\d{4}$/).optional().nullable().or(z.literal("")),
  address1: z.string().max(100).optional().nullable(),
  address2: z.string().max(100).optional().nullable(),
  contacts: z
    .array(
      z.object({
        kind: z.enum(["to", "cc"]),
        name: z.string().max(50).optional().nullable(),
        email: z.string().trim().email().max(254),
      }),
    )
    .min(1)
    .max(10)
    .refine((list) => list.some((c) => c.kind === "to"), "宛先（To）を1件以上登録してください"),
});
export type CustomerInput = z.infer<typeof customerInputSchema>;

const CUSTOMER_COLUMNS =
  "id, merchant_id, name, contact_name, charge_day, billing_note, internal_memo, postal_code, address1, address2, registration_token, usen_member_id, card_brand, card_last4, card_expire_ym, card_registered_at";

interface CustomerRow {
  id: string;
  merchant_id: string;
  name: string;
  contact_name: string | null;
  charge_day: number | null;
  billing_note: string | null;
  internal_memo: string | null;
  postal_code: string | null;
  address1: string | null;
  address2: string | null;
  registration_token: string;
  usen_member_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  card_expire_ym: string | null;
  card_registered_at: string | null;
}

interface ContactRow {
  customer_id: string;
  kind: "to" | "cc";
  name: string | null;
  email: string;
}

/** DB 行を顧客に変換する */
function toCustomer(row: CustomerRow, contacts: ContactRow[]): ProdCustomer {
  return {
    id: row.id,
    merchantId: row.merchant_id,
    name: row.name,
    contactName: row.contact_name,
    chargeDay: row.charge_day,
    billingNote: row.billing_note,
    internalMemo: row.internal_memo,
    postalCode: row.postal_code,
    address1: row.address1,
    address2: row.address2,
    registrationToken: row.registration_token,
    usenMemberId: row.usen_member_id,
    cardBrand: row.card_brand,
    cardLast4: row.card_last4,
    cardExpireYm: row.card_expire_ym,
    cardRegisteredAt: row.card_registered_at,
    contacts: contacts
      .filter((c) => c.customer_id === row.id)
      .map((c) => ({ kind: c.kind, name: c.name, email: c.email })),
  };
}

/** 顧客の宛先を読み込む */
async function loadContacts(client: SupabaseClient, customerIds: string[]): Promise<ContactRow[]> {
  if (customerIds.length === 0) return [];
  const { data, error } = await client
    .from("udpay_customer_contacts")
    .select("customer_id, kind, name, email")
    .in("customer_id", customerIds)
    .is("deleted_at", null)
    .order("sort");
  if (error) throw new Error(`宛先の取得に失敗: ${error.message}`);
  return (data ?? []) as ContactRow[];
}

/** 加盟店の顧客一覧（登録順） */
export async function listCustomers(client: SupabaseClient, merchantId: string): Promise<ProdCustomer[]> {
  const { data, error } = await client
    .from("udpay_customers")
    .select(CUSTOMER_COLUMNS)
    .eq("merchant_id", merchantId)
    .is("deleted_at", null)
    .order("created_at");
  if (error) throw new Error(`顧客の取得に失敗: ${error.message}`);
  const rows = (data ?? []) as CustomerRow[];
  const contacts = await loadContacts(client, rows.map((r) => r.id));
  return rows.map((r) => toCustomer(r, contacts));
}

/** 顧客1件 */
export async function getCustomer(client: SupabaseClient, id: string): Promise<ProdCustomer | null> {
  const { data, error } = await client
    .from("udpay_customers")
    .select(CUSTOMER_COLUMNS)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`顧客の取得に失敗: ${error.message}`);
  if (!data) return null;
  return toCustomer(data as CustomerRow, await loadContacts(client, [id]));
}

/** カード登録リンクのトークンから顧客を探す */
export async function findCustomerByToken(
  client: SupabaseClient,
  token: string,
): Promise<ProdCustomer | null> {
  const { data, error } = await client
    .from("udpay_customers")
    .select(CUSTOMER_COLUMNS)
    .eq("registration_token", token)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`顧客の取得に失敗: ${error.message}`);
  if (!data) return null;
  const row = data as CustomerRow;
  return toCustomer(row, await loadContacts(client, [row.id]));
}

/** 入力を DB 列に変換する（空文字は NULL） */
function toColumns(input: CustomerInput) {
  const blank = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);
  return {
    name: input.name.trim(),
    contact_name: blank(input.contactName),
    charge_day: input.chargeDay,
    billing_note: blank(input.billingNote),
    internal_memo: blank(input.internalMemo),
    postal_code: blank(input.postalCode),
    address1: blank(input.address1),
    address2: blank(input.address2),
  };
}

/** 宛先を差し替える（既存はソフトデリートして入れ直す） */
async function replaceContacts(client: SupabaseClient, customerId: string, contacts: CustomerInput["contacts"]) {
  const { error: delError } = await client
    .from("udpay_customer_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("customer_id", customerId)
    .is("deleted_at", null);
  if (delError) throw new Error(`宛先の更新に失敗: ${delError.message}`);
  const rows = contacts.map((c, i) => ({
    customer_id: customerId,
    kind: c.kind,
    name: c.name?.trim() || null,
    email: c.email.trim(),
    sort: i,
  }));
  const { error } = await client.from("udpay_customer_contacts").insert(rows);
  if (error) throw new Error(`宛先の登録に失敗: ${error.message}`);
}

/** 顧客を登録し、カード登録リンクのトークンを発行する */
export async function createCustomer(
  client: SupabaseClient,
  merchantId: string,
  input: CustomerInput,
): Promise<ProdCustomer> {
  const { data, error } = await client
    .from("udpay_customers")
    .insert({ merchant_id: merchantId, registration_token: newRegistrationToken(), ...toColumns(input) })
    .select("id")
    .single();
  if (error || !data) throw new Error(`顧客の登録に失敗: ${error?.message ?? "不明"}`);
  await replaceContacts(client, data.id as string, input.contacts);
  const created = await getCustomer(client, data.id as string);
  if (!created) throw new Error("登録した顧客を読み込めません");
  return created;
}

/** 顧客の登録内容を編集する（カード情報・登録リンクは変えない） */
export async function updateCustomer(
  client: SupabaseClient,
  id: string,
  input: CustomerInput,
): Promise<ProdCustomer | null> {
  const { data, error } = await client
    .from("udpay_customers")
    .update(toColumns(input))
    .eq("id", id)
    .is("deleted_at", null)
    .select("id");
  if (error) throw new Error(`顧客の更新に失敗: ${error.message}`);
  if (!data || data.length === 0) return null;
  await replaceContacts(client, id, input.contacts);
  return getCustomer(client, id);
}
