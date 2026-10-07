/**
 * QOLC Wallet: 記録（purchase_declarations）の読み書きと、API で返す形への変換。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/** レシート画像のバケット */
export const WALLET_RECEIPT_BUCKET = "wallet-receipts";

/** 一覧・詳細で読む列 */
export const DECLARATION_SELECT =
  "id, facility_id, resident_id, card_id, status, payment_method, selected_at, paid_at, amount, entered_amount, merchant_name, printed_at, " +
  "residents(name_last, name_first), receipt_images(storage_path, ocr_items, ocr_payment_label, ocr_card_last4, deleted_at)";

/** レシートの明細（読み取り結果） */
export const receiptItemSchema = z.object({ name: z.string().max(200), amount: z.number().int() });
export type ReceiptItem = z.infer<typeof receiptItemSchema>;

/** DB の行（DECLARATION_SELECT の結果） */
export interface DeclarationRow {
  id: string;
  facility_id: string;
  resident_id: string;
  card_id: string | null;
  status: string;
  payment_method: string;
  selected_at: string;
  paid_at: string | null;
  amount: number | null;
  entered_amount: number | null;
  merchant_name: string | null;
  printed_at: string | null;
  residents: { name_last: string; name_first: string } | null;
  receipt_images: {
    storage_path: string;
    ocr_items: unknown;
    ocr_payment_label: string | null;
    ocr_card_last4: string | null;
    deleted_at: string | null;
  }[] | null;
}

/** API で返す記録（iOS アプリの Declaration と同じ形） */
export interface DeclarationDto {
  id: string;
  resident_id: string;
  resident_name: string;
  status: string;
  payment_method: string;
  selected_at: string;
  paid_at: string | null;
  amount: number | null;
  entered_amount: number | null;
  merchant_name: string | null;
  receipt_image_url: string | null;
  receipt_items: ReceiptItem[] | null;
  receipt_payment_label: string | null;
  receipt_card_last4: string | null;
}

/** 有効なレシート（削除されていないもの） */
export function activeReceipt(row: DeclarationRow) {
  return (row.receipt_images ?? []).find((r) => r.deleted_at === null) ?? null;
}

/** DB の行を API の形にする。画像の URL は呼び出し側で署名して渡す */
export function toDto(row: DeclarationRow, imageUrl: string | null = null): DeclarationDto {
  const receipt = activeReceipt(row);
  const items = z.array(receiptItemSchema).safeParse(receipt?.ocr_items);
  return {
    id: row.id,
    resident_id: row.resident_id,
    resident_name: row.residents ? `${row.residents.name_last} ${row.residents.name_first}` : "",
    status: row.status,
    payment_method: row.payment_method,
    selected_at: row.selected_at,
    paid_at: row.paid_at,
    amount: row.amount,
    entered_amount: row.entered_amount,
    merchant_name: row.merchant_name,
    receipt_image_url: imageUrl,
    receipt_items: receipt && items.success ? items.data : null,
    receipt_payment_label: receipt?.ocr_payment_label ?? null,
    receipt_card_last4: receipt?.ocr_card_last4 ?? null,
  };
}

/** レシート画像の署名付き URL（1時間有効） */
export async function signedImageUrl(admin: SupabaseClient, row: DeclarationRow): Promise<string | null> {
  const receipt = activeReceipt(row);
  if (!receipt) return null;
  const { data } = await admin.storage.from(WALLET_RECEIPT_BUCKET).createSignedUrl(receipt.storage_path, 3600);
  return data?.signedUrl ?? null;
}

/** 行の配列を、画像 URL つきの API の形にする */
export async function toDtos(admin: SupabaseClient, rows: DeclarationRow[]): Promise<DeclarationDto[]> {
  return Promise.all(rows.map(async (row) => toDto(row, await signedImageUrl(admin, row))));
}

/** 自施設の記録を1件読む（無ければ null） */
export async function loadDeclaration(
  admin: SupabaseClient,
  facilityId: string,
  id: string,
): Promise<DeclarationRow | null> {
  const { data } = await admin
    .from("purchase_declarations")
    .select(DECLARATION_SELECT)
    .eq("id", id)
    .eq("facility_id", facilityId)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as DeclarationRow | null) ?? null;
}

/** 日本時間の日付（YYYY-MM-DD）の範囲を UTC の ISO 文字列で返す */
export function jstDayRange(day: string): { from: string; to: string } {
  const from = new Date(`${day}T00:00:00+09:00`);
  const to = new Date(from.getTime() + 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

/** 日時を日本時間の日付（YYYY-MM-DD）にする */
export function jstDate(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3_600_000).toISOString().slice(0, 10);
}
