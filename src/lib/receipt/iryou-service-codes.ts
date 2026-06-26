/**
 * 訪問看護療養費コード → 名称 解決（医療保険）
 *
 * 医療保険の訪問看護レセプト(UKE)のKAレコードは訪問看護療養費コード(9桁)のみを持つ。
 * 名称は社会保険診療報酬支払基金の「訪問看護療養費マスター（基本テーブル）」から取り込む。
 *
 * - iryou-service-codes.json（マスタ取込・自動生成）でコード→漢字名称を解決。
 *   生成は scripts/gen-iryou-service-codes.ts（改定で更新時に再実行）。
 * - マスタに無いコード（改定をまたぐ過去月のコード等）はコードをそのまま返す
 *   （推測で誤名称を出さない）。
 */
import itemNamesJson from "./iryou-service-codes.json";

/** 訪問看護療養費コード(9桁) → 漢字名称（マスタ自動生成） */
const ITEM_NAMES: Record<string, string> = itemNamesJson as Record<string, string>;

/**
 * 訪問看護療養費コードの表示名を返す。
 * マスタにあれば漢字名称、無ければコードをそのまま返す。
 */
export function resolveIryouServiceName(code: string): string {
  const c = (code ?? "").trim();
  return ITEM_NAMES[c] ?? c;
}
