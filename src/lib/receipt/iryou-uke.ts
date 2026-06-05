/**
 * 医療保険 UKE 形式（電子レセプト）パーサー
 *
 * 仕様: 厚生労働省 訪問看護レセプト記録条件仕様書 v1.5 (R08bt1_5_kiroku_nursing.pdf)
 *
 * ファイル形式:
 *   - 本来は固定長テキスト + 改行区切り
 *   - 各行カンマ区切りで先頭2文字がレコード識別 (HM, RE, HO, KO, SY, KA, MF 等)
 *   - 提供者によっては Excel/xlsx 形式で渡される場合あり（本実装は両対応）
 *   - 国保向け: HOレコード(主保険) + KOレコード(公費) 両方記録
 *   - 支払基金向け: HOレコードなし、KOレコードのみ（生活保護等の公費単独ケースが多い）
 *
 * 1患者単位の構成:
 *   RE(共通)
 *   → HO(主保険、国保のみ)
 *   → KO(公費、複数可)
 *   → SY/KA/... (傷病名/行為等、本パーサーでは未使用)
 *   → 次の RE が来るまでが1患者分
 *
 * QOLCの取得対象（自己負担額）:
 *   - HOレコード [8] 一部負担金額（限度額処理後の本人請求確定額）
 *   - KOレコード [6] 一部負担金額（公費負担医療における本人負担額）
 *
 * 自己負担額の決定ロジック（星さん方針: 請求ソフト確定額を直読、独自計算なし）:
 *   1. HO[8] が記録されていればそれを採用（限度額処理後の最終確定額）
 *   2. HO がなく KO[6] のみがあればそれを採用（公費による本人負担額）
 *   3. どちらもなければ 0 円扱い（公費全額負担として決済対象外）
 */

/** 1患者の医療保険レセプト情報 */
export interface IryouReceiptPatient {
  /** 患者のレセプト連番（RE[1]） */
  seq: number;
  /** レセプト種別コード（RE[2]、例: 6122=社保単独・本人） */
  receiptType: string;
  /** 診療年月 (yyyymm)（RE[3]） */
  serviceMonth: string;
  /** 患者氏名（RE[4]） */
  name: string;
  /** カナ氏名（RE[5]） */
  nameKana: string;
  /** 性別 ("1"=男, "2"=女) */
  gender: string;
  /** 生年月日 (yyyymmdd) */
  birthDate: string;
  /** レセプト番号（RE[13]、例: "202605-11534987-0"） */
  receiptNumber: string;
  /** 主保険情報（HOレコード、支払基金等で無いこともある） */
  hoken: IryouReceiptHoken | null;
  /** 公費情報（KOレコード、0件以上） */
  kofu: IryouReceiptKofu[];
  /** 本人負担額（円）★ QOLCで決済する金額 */
  userBurden: number;
}

/** 主保険情報（HOレコード） */
export interface IryouReceiptHoken {
  /** 保険者番号（8桁、左ゼロパディング） */
  hokenshaNumber: string;
  /** 被保険者証 記号 */
  kigou: string;
  /** 被保険者証 番号 */
  bangou: string;
  /** 実日数 */
  actualDays: number;
  /** 合計金額（円、保険請求総額） */
  totalAmount: number;
  /** 一部負担金額（円、限度額処理後の本人負担確定額） */
  userBurden: number;
}

/** 公費情報（KOレコード） */
export interface IryouReceiptKofu {
  /** 公費負担者番号（8桁） */
  futanshaNumber: string;
  /** 公費受給者番号 */
  jukyushaNumber: string;
  /** 実日数 */
  actualDays: number;
  /** 合計金額（円、公費負担医療の合計） */
  totalAmount: number;
  /** 一部負担金額（円、公費における本人負担額） */
  userBurden: number;
}

/** 医療機関情報（HMレコード、ファイル先頭1件） */
export interface IryouReceiptMedicalInstitution {
  /** 医療機関コード */
  code: string;
  /** 医療機関名 */
  name: string;
  /** 処理対象年月 (yyyymm) */
  processingMonth: string;
}

/** パース警告 */
export interface IryouReceiptWarning {
  line: number;
  code: string;
  message: string;
}

/** パース結果 */
export interface IryouReceiptParseResult {
  /** 医療機関情報 */
  institution: IryouReceiptMedicalInstitution | null;
  /** 患者ごとのレセプト */
  patients: IryouReceiptPatient[];
  /** 警告 */
  warnings: IryouReceiptWarning[];
}

/**
 * UKEファイルをパースする。
 *
 * @param rows - 各行を string 配列で表したもの。
 *   xlsx の場合: ExcelJS でセル配列に変換したもの
 *   .UKE テキストの場合: 各行を split(",") したもの
 */
export function parseIryouUke(rows: string[][]): IryouReceiptParseResult {
  const warnings: IryouReceiptWarning[] = [];
  let institution: IryouReceiptMedicalInstitution | null = null;
  const patients: IryouReceiptPatient[] = [];
  let current: IryouReceiptPatient | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const kind = trim(row[0]);

    switch (kind) {
      case "HM": {
        // 医療機関情報レコード（先頭1件）
        // [0]=HM, [1]=区分?, [2]=都道府県?, [3]=点数表?, [4]=機関コード, [5]=機関名, [6]=処理対象年月
        institution = {
          code: trim(row[4]),
          name: trim(row[5]),
          processingMonth: trim(row[6]),
        };
        break;
      }
      case "RE": {
        // レセプト共通レコード（患者ごと、1患者の始まり）
        // 前の患者を確定
        if (current) finalizePatient(current);
        if (current) patients.push(current);
        current = {
          seq: toIntOrZero(row[1]),
          receiptType: trim(row[2]),
          serviceMonth: trim(row[3]),
          name: trim(row[4]),
          nameKana: trim(row[5]),
          gender: trim(row[6]),
          birthDate: trim(row[7]),
          receiptNumber: trim(row[13]),
          hoken: null,
          kofu: [],
          userBurden: 0,
        };
        break;
      }
      case "HO": {
        // 保険者レコード（主保険）
        if (!current) {
          warnings.push({
            line: i + 1,
            code: "ORPHAN_HO",
            message: "REレコードの前にHOレコードが出現しました",
          });
          break;
        }
        // [0]=HO, [1]=保険者番号, [2]=記号, [3]=番号, [4]=実日数, [5]=合計金額,
        // [6]=職務上の事由, [7]=証明書番号, [8]=一部負担金額
        current.hoken = {
          hokenshaNumber: trim(row[1]),
          kigou: trim(row[2]),
          bangou: trim(row[3]),
          actualDays: toIntOrZero(row[4]),
          totalAmount: toIntOrZero(row[5]),
          userBurden: toIntOrZero(row[8]),
        };
        break;
      }
      case "KO": {
        // 公費レコード
        if (!current) {
          warnings.push({
            line: i + 1,
            code: "ORPHAN_KO",
            message: "REレコードの前にKOレコードが出現しました",
          });
          break;
        }
        // [0]=KO, [1]=負担者番号, [2]=受給者番号, [3]=任意給付区分, [4]=実日数,
        // [5]=合計金額, [6]=一部負担金額
        current.kofu.push({
          futanshaNumber: trim(row[1]),
          jukyushaNumber: trim(row[2]),
          actualDays: toIntOrZero(row[4]),
          totalAmount: toIntOrZero(row[5]),
          userBurden: toIntOrZero(row[6]),
        });
        break;
      }
      // SY/KA/SN/JS/RJ/TZ/IH/HJ/MF/GI/GO 等は本パーサーでは未使用
      default:
        break;
    }
  }

  if (current) {
    finalizePatient(current);
    patients.push(current);
  }

  // 警告: 本人負担額0の患者をリスト
  for (const p of patients) {
    if (p.userBurden === 0) {
      warnings.push({
        line: p.seq,
        code: "ZERO_USER_BURDEN",
        message: `患者 ${p.name}(seq=${p.seq}) の本人負担額が 0 円です（公費全額負担または記録なし）`,
      });
    }
  }

  return { institution, patients, warnings };
}

/**
 * 患者の本人負担額を確定する。
 * 1. HO[8] 一部負担金額が記録されていればそれを採用
 * 2. なければ KO[6] のうち1つでも記録されていればその合計
 * 3. どちらもなければ 0 円
 */
function finalizePatient(p: IryouReceiptPatient): void {
  if (p.hoken && p.hoken.userBurden > 0) {
    p.userBurden = p.hoken.userBurden;
    return;
  }
  const kofuTotal = p.kofu.reduce((s, k) => s + k.userBurden, 0);
  p.userBurden = kofuTotal;
}

function trim(v: string | undefined | null): string {
  return (v ?? "").trim();
}

function toIntOrZero(v: string | undefined | null | number): number {
  if (typeof v === "number") return Number.isFinite(v) ? Math.floor(v) : 0;
  const s = trim(v as string | undefined | null);
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

/**
 * xlsx ファイルの ExcelJS ワークシートを行配列に変換するヘルパー。
 * UKEパーサーに渡せる形式に変換する。
 */
export function xlsxSheetToRows(sheet: {
  eachRow(opts: { includeEmpty: boolean }, cb: (row: { eachCell(opts: { includeEmpty: boolean }, cb: (cell: { value: unknown }) => void): void }, rowNum: number) => void): void;
}): string[][] {
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const vals: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => {
      let v = cell.value;
      if (v && typeof v === "object") {
        const obj = v as { text?: string; richText?: Array<{ text: string }> };
        if (obj.text) v = obj.text;
        else if (obj.richText) v = obj.richText.map((r) => r.text).join("");
        else v = JSON.stringify(v);
      }
      vals.push(v === null || v === undefined ? "" : String(v));
    });
    rows.push(vals);
  });
  return rows;
}
