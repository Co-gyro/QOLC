/**
 * サービスコード（6桁）→ サービス名 のマスタ
 *
 * 本番ではDBの `service_codes`（仮）テーブルから取得するが、
 * 開発・テスト用にダミーマスタを保持する。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceMaster } from "./types";

/** 開発用ダミーマスタ（介護サービスコードの代表例） */
export const DEV_SERVICE_MASTER: ServiceMaster = new Map<string, string>([
  ["111111", "訪問介護・身体介護"],
  ["112111", "訪問介護・生活援助"],
  ["121111", "訪問入浴介護"],
  ["131111", "訪問看護"],
  ["141111", "訪問リハビリテーション"],
  ["151111", "通所介護"],
  ["161111", "通所リハビリテーション"],
  ["171111", "短期入所生活介護"],
  ["211111", "介護福祉施設サービス"],
  ["311111", "介護予防訪問介護"],
  ["A11111", "夜間対応型訪問介護"],
  ["B11111", "認知症対応型通所介護"],
  ["C11111", "小規模多機能型居宅介護"],
]);

/**
 * サービスコードから名称を解決する。マスタにない場合は空文字またはコード自体を返す。
 */
export function resolveServiceName(
  code: string,
  master: ServiceMaster
): string {
  return master.get(code) ?? `(未登録: ${code})`;
}

/**
 * Supabase の `service_codes` テーブルからマスタをロードする。
 * テーブルがまだ存在しない場合は DEV_SERVICE_MASTER を返す。
 */
export async function loadServiceMasterFromDb(
  client: SupabaseClient
): Promise<ServiceMaster> {
  // 注: `service_codes` テーブルは未マイグレーションのため、
  // ここでは例外を握りつぶして DEV マスタへフォールバックする。
  try {
    const { data, error } = await client
      .from("service_codes")
      .select("code, name");
    if (error || !data) {
      return DEV_SERVICE_MASTER;
    }
    const map: ServiceMaster = new Map();
    for (const row of data as Array<{ code: string; name: string }>) {
      map.set(row.code, row.name);
    }
    return map.size > 0 ? map : DEV_SERVICE_MASTER;
  } catch {
    return DEV_SERVICE_MASTER;
  }
}
