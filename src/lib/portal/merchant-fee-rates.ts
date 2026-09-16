/**
 * 加盟店ごとの料率（精算料率 / カード会社手数料率 JCB・セゾン）を一覧表示用にまとめる。
 *
 * 料率の置き場は元申請の UD追記情報（applications.ud_input）。加盟店管理の一覧で
 * 「Selfish へ送る料率」が入力済みかを一目で確認できるよう、merchant_id ごとに
 * 最新の申請から読む。applications 未適用・権限エラー時は空 Map にフォールバックする。
 */
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { parseUdInput } from "@/lib/applications/ud-input";

/** 加盟店1件分の料率（%表記の文字列。未入力は null） */
export interface MerchantFeeRates {
  /** 精算料率（加盟店との契約料率。全ブランド共通） */
  settlement: string | null;
  /** カード会社手数料率 JCB（UD→JCB） */
  jcb: string | null;
  /** カード会社手数料率 セゾン（UD→セゾン） */
  saison: string | null;
  /** 旧・共通欄の値（ブランド別が未入力のときの暫定値） */
  legacy: string | null;
}

/** ud_input から料率だけを取り出す（純関数） */
export function summarizeFeeRates(udInput: Record<string, unknown> | null | undefined): MerchantFeeRates {
  const { fields } = parseUdInput(udInput ?? null);
  return {
    settlement: fields.settlement_rate ?? null,
    jcb: fields.card_company_fee_rate_jcb ?? null,
    saison: fields.card_company_fee_rate_saison ?? null,
    legacy: fields.card_company_fee_rate ?? null,
  };
}

/** 一覧表示用の短い文字列（例: "精算 1.9% / JCB 3.0% / セゾン —"） */
export function formatFeeRates(r: MerchantFeeRates | null | undefined): string {
  const pct = (v: string | null, fallback: string | null = null) =>
    v ? `${v}%` : fallback ? `${fallback}%（旧共通）` : "—";
  if (!r) return "—";
  return `精算 ${pct(r.settlement)} / JCB ${pct(r.jcb, r.legacy)} / セゾン ${pct(r.saison, r.legacy)}`;
}

/** 申請行の最小形（merchant_id ごとに最新1件を採用するための入力） */
interface ApplicationRateRow {
  merchant_id: string | null;
  ud_input: Record<string, unknown> | null;
  created_at: string;
}

/** 申請行を merchant_id ごとにまとめる（最新の created_at を採用。純関数） */
export function groupFeeRatesByMerchant(rows: ApplicationRateRow[]): Map<string, MerchantFeeRates> {
  const latest = new Map<string, ApplicationRateRow>();
  for (const row of rows) {
    if (!row.merchant_id) continue;
    const prev = latest.get(row.merchant_id);
    if (!prev || row.created_at > prev.created_at) latest.set(row.merchant_id, row);
  }
  const map = new Map<string, MerchantFeeRates>();
  latest.forEach((row, id) => map.set(id, summarizeFeeRates(row.ud_input)));
  return map;
}

/** 加盟店ID → 料率 のマップを取得する（失敗時は空 Map） */
export async function fetchMerchantFeeRates(): Promise<Map<string, MerchantFeeRates>> {
  try {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("applications")
      .select("merchant_id, ud_input, created_at")
      .eq("source", "qolc_merchant")
      .not("merchant_id", "is", null)
      .is("deleted_at", null)
      .limit(500);
    if (error) return new Map();
    return groupFeeRatesByMerchant((data ?? []) as unknown as ApplicationRateRow[]);
  } catch {
    return new Map();
  }
}
