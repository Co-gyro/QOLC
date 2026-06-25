/**
 * 介護サービスコード → 名称 解決
 *
 * 国保連レセプト（区分02）はサービス種類コード(2桁)・サービス項目コード(4桁)のみを持ち、
 * 名称は含まない。名称は公開の「介護給付費単位数等サービスコード表」から取り込む。
 *
 * - 項目名（サービス内容略称）: kaigo-service-codes.json（マスタ取込・自動生成）から解決。
 *   生成は scripts/gen-kaigo-service-codes.ts（マスタ更新時に再実行）。
 * - サービス種類（大分類）: 小規模テーブルを内蔵（未知コードのフォールバック用）。
 * - マスタに無いコードは「種類名（項目コード）」で返す（推測で誤名称を出さない）。
 */
import itemNamesJson from "./kaigo-service-codes.json";

/** サービスコード「種類:項目」→ サービス内容略称（マスタ自動生成） */
const ITEM_NAMES: Record<string, string> = itemNamesJson as Record<string, string>;

/** サービス種類コード（2桁）→ 名称（大分類） */
const SERVICE_TYPE_NAMES: Record<string, string> = {
  "11": "訪問介護",
  "12": "訪問入浴介護",
  "13": "訪問看護",
  "14": "訪問リハビリテーション",
  "15": "通所介護",
  "16": "通所リハビリテーション",
  "17": "福祉用具貸与",
  "21": "短期入所生活介護",
  "22": "短期入所療養介護（老健）",
  "23": "短期入所療養介護（病院等）",
  "24": "短期入所療養介護（医療院）",
  "31": "居宅療養管理指導",
  "32": "特定施設入居者生活介護",
  "33": "認知症対応型共同生活介護",
  "36": "地域密着型通所介護",
  "39": "定期巡回・随時対応型訪問介護看護",
  "43": "夜間対応型訪問介護",
  "61": "介護予防訪問介護",
  "65": "介護予防通所介護",
  "78": "居宅介護支援",
};

/** サービス種類名（大分類）を返す。未知は「サービス種類NN」。 */
export function resolveServiceTypeName(serviceTypeCode: string): string {
  return SERVICE_TYPE_NAMES[serviceTypeCode] ?? `サービス種類${serviceTypeCode || "?"}`;
}

/**
 * サービス内容の表示名を返す。
 * マスタに項目名（サービス内容略称）があればそれを返す。
 * 無い場合は「種類名（項目コード）」（推測しない）。
 */
export function resolveServiceName(
  serviceTypeCode: string,
  serviceItemCode: string
): string {
  const key = `${serviceTypeCode.padStart(2, "0")}:${serviceItemCode.padStart(4, "0")}`;
  const itemName = ITEM_NAMES[key];
  if (itemName) return itemName;
  if (serviceItemCode) return `${resolveServiceTypeName(serviceTypeCode)}（${serviceItemCode}）`;
  return resolveServiceTypeName(serviceTypeCode);
}
