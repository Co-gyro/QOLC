/**
 * 介護サービスコード → 名称 解決
 *
 * 国保連レセプト（区分02）はサービス種類コード(2桁)・サービス項目コード(4桁)のみを持ち、
 * 名称は含まない。名称表示には公開の「介護サービスコード表」マスタが必要。
 *
 * 現状:
 *   - サービス種類（大分類, 2桁）: 安定した小規模テーブルとして内蔵（信頼できる）。
 *   - サービス項目（4桁）: 公開マスタ未取り込みのため、判明分のみ ITEM_NAMES に seed。
 *     未知の項目はコードを併記して返す（推測で誤名称を出さない）。
 *
 * 公開マスタ（介護サービスコード表）を取り込めば item 名称を完全化できる。
 */

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

/**
 * サービス項目コード（4桁）→ 名称。公開マスタ未取り込みのため判明分のみ。
 * キーは "種類コード:項目コード"（種類により同じ項目コードでも内容が異なるため）。
 */
const ITEM_NAMES: Record<string, string> = {
  // 実サンプル等から判明したもの。随時追加可能。
};

/** サービス種類名（大分類）を返す。未知は「サービス種類NN」。 */
export function resolveServiceTypeName(serviceTypeCode: string): string {
  return SERVICE_TYPE_NAMES[serviceTypeCode] ?? `サービス種類${serviceTypeCode || "?"}`;
}

/**
 * サービス内容の表示名を返す。
 * 項目名が判明していれば「種類名 項目名」、未判明なら「種類名（項目コード）」。
 */
export function resolveServiceName(
  serviceTypeCode: string,
  serviceItemCode: string
): string {
  const typeName = resolveServiceTypeName(serviceTypeCode);
  const itemName = ITEM_NAMES[`${serviceTypeCode}:${serviceItemCode}`];
  if (itemName) return `${typeName} ${itemName}`;
  if (serviceItemCode) return `${typeName}（${serviceItemCode}）`;
  return typeName;
}
