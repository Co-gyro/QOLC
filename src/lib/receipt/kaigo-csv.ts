/**
 * 介護保険給付費請求情報 CSV パーサー
 *
 * 仕様: 国保連 統一仕様（厚生労働省告示「介護給付費等の請求及び受領」準拠）
 *
 * ファイル形式:
 *   - 文字コード: Shift-JIS (CP932)
 *   - 改行: CRLF
 *   - 区切り: カンマ
 *   - 値: ダブルクォート囲み
 *   - 1ファイル = 1事業所の1月分
 *
 * レコード構造:
 *   [0]="1",...                       コントロールレコード (先頭1件)
 *   [0]="2",[1]=seq,[2]="7111",...    給付費請求情報サマリー（事業所単位）
 *   [0]="2",[1]=seq,[2]="7131",[3]="01",... 明細書基本情報（1利用者の月集計）★ここに利用者負担額
 *   [0]="2",[1]=seq,[2]="7131",[3]="02",... サービス明細（1サービスコードごと）
 *   [0]="2",[1]=seq,[2]="7141",[3]="01",... 短期入所等 別データ種別
 *   [0]="3",...                       エンドレコード
 *
 * 明細書基本情報レコード (7131-01) の主要フィールド位置（0-indexed）:
 *   [3]="01" 区分
 *   [4] サービス提供年月 (yyyymm)
 *   [5] 事業所番号
 *   [6] 介護保険者番号
 *   [7] 被保険者番号（10桁、先頭0保持）
 *  [14] 生年月日 (yyyymmdd)
 *  [15] 性別 (1=男, 2=女)
 *  [16] 要介護度コード
 *  [30] 給費率 (90/80/70 等)
 *  [34] 合計単位数
 *  [35] 保険請求額（円）＝介護保険給付額
 *  [36] 利用者負担額（円・保険分）
 *  公費ブロック（6幅: 単位数/請求額/本人負担/予備3。仕様書 ⑫公費請求額 ⑬公費分本人負担）:
 *    公費1=[40..45]（請求額[41]/本人負担[42]）, 公費2=[46..51]（[47]/[48]）, 公費3=[52..57]（[53]/[54]）
 *  → 公費負担額 = Σ公費請求額([41]+[47]+[53])。決済対象(本人請求) = [36] − 公費負担額。
 *
 * 端数処理: 円単位は Math.floor（Phase 0 慣習）
 */
import { convert } from "encoding-japanese";
import Papa from "papaparse";

/**
 * サービス明細（7131-02）1行。サービスコード単位の単位数・回数。
 * レセプトには日付・時間は含まれない（月単位でサービスコードごとに集約）。
 */
export interface KaigoServiceDetail {
  /** サービス種類コード（2桁。例 11=訪問介護, 13=訪問看護, 15=通所介護） */
  serviceTypeCode: string;
  /** サービス項目コード（4桁。例 1111） */
  serviceItemCode: string;
  /** 単位数（単価） */
  unitScore: number;
  /** 回数・日数 */
  count: number;
  /** サービス単位数（合計＝単位数×回数 等、レセプト記載値） */
  totalUnits: number;
}

/** 1利用者の1月分の介護保険請求情報 */
export interface KaigoReceiptResident {
  /** 被保険者番号 (10桁、先頭0保持の文字列) */
  insuranceNumber: string;
  /** 介護保険者番号 */
  insurerNumber: string;
  /** サービス提供年月 (yyyymm) */
  serviceMonth: string;
  /** 生年月日 (yyyymmdd)、不明な場合は空文字 */
  birthDate: string;
  /** 性別 ("1"=男 "2"=女、不明は空文字) */
  gender: string;
  /** 給付率パーセント (90/80/70/0)。0は不明 */
  benefitRatePercent: number;
  /** 合計単位数 */
  totalUnits: number;
  /** 保険請求額（円）＝介護保険給付額 */
  insuranceClaim: number;
  /** 公費負担額（円・公費請求額の合計）。公費なしは0 */
  koufuBenefit: number;
  /** 利用者負担額（円）★ QOLCで決済する金額。公費併用時は公費控除後の最終本人負担 */
  userBurden: number;
  /** サービス明細（区分02）。明細書(B案)用。日付・時間はレセプトに無い */
  serviceDetails: KaigoServiceDetail[];
}

/** パース時の警告（処理は継続される非致命的問題） */
export interface KaigoReceiptWarning {
  line: number;
  code: string;
  message: string;
}

/** パース結果 */
export interface KaigoReceiptParseResult {
  /** 事業所番号（10桁） */
  facilityNumber: string;
  /** 処理対象年月 (yyyymm) */
  processingMonth: string;
  /** 入居者ごとの請求情報 */
  residents: KaigoReceiptResident[];
  /** 非致命的警告 */
  warnings: KaigoReceiptWarning[];
}

/**
 * 介護保険給付費請求情報CSVをパースする。
 *
 * @param input - SJIS バイナリ (Buffer/Uint8Array) または UTF-8 文字列
 */
export function parseKaigoCsv(
  input: Buffer | Uint8Array | string
): KaigoReceiptParseResult {
  const text = decodeToUtf8(input);
  const warnings: KaigoReceiptWarning[] = [];

  const parsed = Papa.parse<string[]>(text, {
    delimiter: ",",
    quoteChar: '"',
    skipEmptyLines: true,
  });

  for (const e of parsed.errors) {
    warnings.push({
      line: (e.row ?? 0) + 1,
      code: e.code ?? "CSV_PARSE",
      message: e.message,
    });
  }

  const rows = parsed.data;
  let facilityNumber = "";
  let processingMonth = "";
  const residents: KaigoReceiptResident[] = [];
  // 区分02を被保険者番号で対応付けるための索引（同一ファイル内で一意）
  const byInsuranceNumber = new Map<string, KaigoReceiptResident>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const recordType = trim(row[0]);

    if (recordType === "1") {
      // コントロールレコード
      // 想定フィールド位置: [4]=事業所番号系種別, [7]=事業所番号, [10]=処理年月
      // 実データ例:
      //  ["1","1","0","261","711","0","0","1070206428","0","7","202605","0"]
      facilityNumber = trim(row[7]);
      processingMonth = trim(row[10]);
      continue;
    }

    if (recordType === "3") {
      // エンドレコード
      break;
    }

    if (recordType !== "2") continue;

    const dataKind = trim(row[2]);
    const subKubun = trim(row[3]);

    // 給付費請求情報サマリーレコード (7111) は集計のみで個別利用者情報なし
    if (dataKind === "7111") continue;

    // 明細書基本情報レコード (7131/7141 など、区分=01) ← QOLCの主処理対象
    if ((dataKind === "7131" || dataKind === "7141") && subKubun === "01") {
      const resident = parseDetailHeaderRow(row, i + 1, warnings);
      if (resident) {
        residents.push(resident);
        byInsuranceNumber.set(resident.insuranceNumber, resident);
      }
      continue;
    }

    // 区分=02 はサービス明細（サービスコード別の単位数・回数）。明細書(B案)用に捕捉。
    // 本人負担額は区分01から直読するため金額計算には使わない。
    if ((dataKind === "7131" || dataKind === "7141") && subKubun === "02") {
      const detail = parseServiceDetailRow(row);
      const owner = byInsuranceNumber.get(trim(row[7]));
      if (detail && owner) owner.serviceDetails.push(detail);
      continue;
    }
  }

  return {
    facilityNumber,
    processingMonth,
    residents,
    warnings,
  };
}

/**
 * 明細書基本情報レコード（7131-01）から1利用者分の情報を抽出する。
 */
function parseDetailHeaderRow(
  row: string[],
  lineNumber: number,
  warnings: KaigoReceiptWarning[]
): KaigoReceiptResident | null {
  const insuranceNumber = trim(row[7]);
  if (!insuranceNumber) {
    warnings.push({
      line: lineNumber,
      code: "MISSING_INSURANCE_NUMBER",
      message: "明細書基本情報レコードに被保険者番号がありません",
    });
    return null;
  }

  // 利用者負担額(保険分) = 公費負担額 + 公費控除後の最終本人負担
  const userBurdenRaw = toIntOrZero(row[36]);
  // 公費負担額 = Σ公費請求額（公費1〜3。各6幅ブロックの請求額位置）
  const koufuBenefit =
    toIntOrZero(row[41]) + toIntOrZero(row[47]) + toIntOrZero(row[53]);
  // 決済対象＝最終本人負担（公費控除後）。負値はガード。
  const userBurden = Math.max(0, userBurdenRaw - koufuBenefit);
  if (userBurden === 0 && koufuBenefit === 0) {
    warnings.push({
      line: lineNumber,
      code: "ZERO_USER_BURDEN",
      message: `被保険者番号 ${insuranceNumber} の利用者負担額が 0 円です（公費全額負担の可能性）`,
    });
  }

  return {
    insuranceNumber,
    insurerNumber: trim(row[6]),
    serviceMonth: trim(row[4]),
    birthDate: trim(row[14]),
    gender: trim(row[15]),
    benefitRatePercent: toIntOrZero(row[30]),
    totalUnits: toIntOrZero(row[34]),
    insuranceClaim: toIntOrZero(row[35]),
    koufuBenefit,
    userBurden,
    serviceDetails: [],
  };
}

/**
 * サービス明細レコード（7131-02）を1件パースする。
 * フィールド位置: [8]=サービス種類コード [9]=サービス項目コード
 *   [10]=単位数(単価) [11]=回数/日数 [15]=サービス単位数(合計)
 * サービス項目コードが空の行（区切り等）は null。
 */
function parseServiceDetailRow(row: string[]): KaigoServiceDetail | null {
  const serviceTypeCode = trim(row[8]);
  const serviceItemCode = trim(row[9]);
  if (!serviceTypeCode && !serviceItemCode) return null;
  return {
    serviceTypeCode,
    serviceItemCode,
    unitScore: toIntOrZero(row[10]),
    count: toIntOrZero(row[11]),
    totalUnits: toIntOrZero(row[15]),
  };
}

function trim(v: string | undefined | null): string {
  return (v ?? "").trim();
}

/** 文字列を整数に変換、不正値は 0 */
function toIntOrZero(v: string | undefined | null): number {
  const s = trim(v);
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

/** SJIS バイナリ or UTF-8 文字列 → UTF-8 文字列 */
function decodeToUtf8(input: Buffer | Uint8Array | string): string {
  if (typeof input === "string") return input;
  const arr = input instanceof Buffer ? Array.from(input) : Array.from(input);
  const converted = convert(arr, {
    to: "UNICODE",
    from: "SJIS",
    type: "string",
  });
  return typeof converted === "string" ? converted : String(converted);
}
