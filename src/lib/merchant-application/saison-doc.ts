/**
 * セゾン加盟店申請（審査FMT）の生成ロジック
 *
 * 様式: templates/saison-shinsa-fmt.xlsx（セゾン提供・2026-07 受領。マクロなしで受理可）
 * - 「新規FMT」シートの1行（row 4）に店子情報を転記する（1行=1店子のフラット形式）
 * - 色分け凡例: 橙=取引先必須 / 赤=条件付必須 / 黄=セゾン補記（触らない） / 青系=個人時必須
 * - カナ列は半角カナ指定 → 全角収集値を toHalfWidthKana で変換
 * - 提出はクリプト便（セゾン連絡・2026-07-24）
 */
import type ExcelJS from "exceljs";
import { toHalfWidthKana } from "@/lib/utils/kana";
import { parseUdInput } from "@/lib/applications/ud-input";
import type { DateParts } from "@/lib/workflow/utils";

/** データを書き込む行（ヘッダ=2行目・形式注記=3行目の直下） */
export const SAISON_DATA_ROW = 4;

/**
 * 固定値（QOLC=非対面・トークン決済の申告内容。JCB申請書の AUTO_VALUES と整合）
 * BB=特商法該当なし / BG=カード情報保持していない / BH=PCIDSS等対応している /
 * BJ=対応内容:非保持 / BN=3Dセキュア実施 / BP=セキュリティコード実施 /
 * BR=属性・行動分析なし / BT=不正配送先活用なし
 */
export const SAISON_FIXED: Record<string, string> = {
  BB: "00",
  BG: "2",
  BH: "1",
  BJ: "2",
  BN: "1",
  BP: "1",
  BR: "3",
  BT: "3",
};

/** 列レター → 値 のマップ */
export type SaisonRowValues = Record<string, string>;

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** "YYYY-MM-DD" → "YYYYMMDD" */
function toYmd(v: string): string {
  return v.replace(/-/g, "");
}

/** 郵便番号のハイフン除去 */
function strip(v: string): string {
  return v.replace(/-/g, "");
}

export interface SaisonBuildResult {
  values: SaisonRowValues;
  /** 生成は可能だが手入力が残る項目（Excel上で補完してもらう） */
  manualNotes: string[];
  /** 生成をブロックする不足項目 */
  errors: string[];
}

/**
 * 申請データ（payload + ud_input）からセゾン審査FMTの1行分を組み立てる。
 * @param payload 公開フォームの入力
 * @param udInput UD追記情報（採番・カナ・補足）
 */
export function buildSaisonRow(
  payload: Record<string, unknown> | null | undefined,
  udInput: Record<string, unknown> | null | undefined
): SaisonBuildResult {
  const p = payload ?? {};
  const { fields, codes } = parseUdInput(udInput ?? null);
  const isIndividual = s(p.corpType) === "個人事業主";
  const errors: string[] = [];
  const manualNotes: string[] = [];

  const corpNameKana = s(p.corpNameKana);
  const facilityNameKana = s(p.facilityNameKana);
  const repKana = [s(p.repLastNameKana), s(p.repFirstNameKana)].filter(Boolean).join(" ");
  if (!corpNameKana || !facilityNameKana || !repKana) {
    errors.push("フリガナ（法人名・代表者・施設名）が不足しています（旧フォーム受付分は記載内容の確認から補完してください）");
  }
  if (!isIndividual && !s(p.corporateNumber)) {
    errors.push("法人番号がありません");
  }
  if (!fields.tenant_addr_kana) {
    errors.push("施設住所フリガナが未入力です（UD追記情報の申請書用補足）");
  }
  if (!fields.handling_products) {
    errors.push("取扱商材が未入力です（UD追記情報の申請書用補足）");
  }
  if (!codes) {
    errors.push("採番が未実施です（相手先管理番号にモールコードを使用します）");
  }

  const values: SaisonRowValues = {
    ...SAISON_FIXED,
    F: isIndividual ? "02" : "01",
    J: toHalfWidthKana(corpNameKana),
    K: s(p.corpName),
    L: strip(s(p.postalCode)),
    N: s(p.address),
    O: s(p.phone),
    R: toHalfWidthKana(repKana),
    S: [s(p.repLastName), s(p.repFirstName)].filter(Boolean).join("　"),
    U: toYmd(s(p.repBirthdate)),
    Z: toHalfWidthKana(facilityNameKana),
    AA: s(p.facilityName),
    AC: strip(s(p.facilityPostalCode)),
    AD: fields.tenant_addr_kana ? toHalfWidthKana(fields.tenant_addr_kana) : "",
    AE: s(p.facilityAddress),
    AF: s(p.facilityPhone),
    AQ: codes?.mall_code ?? "",
    AS: fields.handling_products ?? "",
  };
  if (!isIndividual) {
    values.G = s(p.corporateNumber);
  } else {
    // 個人事業主: 代表者の性別は未収集のため 03（不明）、住所は申込者と同一
    values.T = "03";
    values.V = strip(s(p.postalCode));
    values.W = fields.company_addr_kana ? toHalfWidthKana(fields.company_addr_kana) : "";
    values.X = s(p.address);
    values.Y = s(p.phone);
    if (!fields.company_addr_kana) {
      errors.push("会社（申込者）住所フリガナが未入力です（個人事業主は代表者住所カナに必要）");
    }
  }
  if (fields.tenant_name_latin) {
    values.CS = fields.tenant_name_latin; // 加盟店名（英字）: ACQ有のため設定
  }

  // 未収集のためExcel上で補完が必要な項目
  manualNotes.push("店舗URL（AG列・非対面必須）: 施設のWebサイトURLを入力してください");

  return { values, manualNotes, errors };
}

/** ワークブックの「新規FMT」シートへ1行分を書き込む（テンプレは呼び出し側でロード） */
export function fillSaisonWorkbook(wb: ExcelJS.Workbook, values: SaisonRowValues): void {
  const ws = wb.getWorksheet("新規FMT");
  if (!ws) throw new Error("テンプレートに「新規FMT」シートがありません");
  const row = ws.getRow(SAISON_DATA_ROW);
  for (const [col, value] of Object.entries(values)) {
    if (value !== "") row.getCell(col).value = value;
  }
  row.commit();
}

/** 提出ファイル名（例: セゾン新規_20260724_サンプルケアホーム.xlsx） */
export function buildSaisonFilename(name: string, parts: DateParts): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const safe = name.replace(/[\\/:*?"<>|]/g, "").trim() || "加盟店";
  return `セゾン新規_${parts.year}${p(parts.month)}${p(parts.day)}_${safe}.xlsx`;
}
