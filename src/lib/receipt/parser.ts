/**
 * 厚労省標準CSV（介護レセコン伝送用）パーサー
 *
 * 入力: Shift-JIS バイナリ Buffer | string（既にデコード済み）
 * 出力: ReceiptParseResult（data + warnings）
 *
 * 端数処理: 円単位は Math.floor（Phase 0 と同じ規則）
 */
import { convert } from "encoding-japanese";
import Papa from "papaparse";
import type {
  ReceiptData,
  ReceiptResident,
  ReceiptService,
  ReceiptParseResult,
  ReceiptParseWarning,
  ServiceMaster,
} from "./types";
import { DEV_SERVICE_MASTER, resolveServiceName } from "./service-master";

export interface ParseOptions {
  master?: ServiceMaster;
}

/**
 * バイナリ（Shift-JIS）または既デコード文字列をパースしてレセプトデータを返す。
 */
export function parseReceiptCsv(
  input: Buffer | Uint8Array | string,
  options: ParseOptions = {}
): ReceiptParseResult {
  const text = decodeToUtf8(input);
  const master = options.master ?? DEV_SERVICE_MASTER;
  const warnings: ReceiptParseWarning[] = [];

  // PapaParse でフィールド単位に分解
  const parsed = Papa.parse<string[]>(text, {
    delimiter: ",",
    quoteChar: '"',
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    for (const e of parsed.errors) {
      warnings.push({
        line: e.row ?? 0,
        code: e.code ?? "CSV_PARSE",
        message: e.message,
      });
    }
  }

  const rows = parsed.data;

  let facilityNumber = "";
  let processingMonth = "";
  let regionalUnitPrice = 10.0;

  const residents: ReceiptResident[] = [];
  let currentResident: ReceiptResident | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const recordType = (row[0] ?? "").trim();

    if (recordType === "1") {
      // コントロールレコード
      // 想定フォーマット: [type=1, facilityNumber, dataKind, processingMonth, regionalUnitPrice?]
      facilityNumber = (row[1] ?? "").trim();
      processingMonth = (row[3] ?? row[2] ?? "").trim();
      const price = Number(row[4]);
      if (Number.isFinite(price) && price > 0) {
        regionalUnitPrice = price;
      }
      continue;
    }

    if (recordType === "3") {
      // エンドレコード
      if (currentResident) {
        residents.push(currentResident);
        currentResident = null;
      }
      break;
    }

    if (recordType !== "2") continue;

    // データレコード: row[1] が レコード種別コード（7111/7131-1/7131-2/7131-10）
    const subType = (row[1] ?? "").trim();

    if (subType === "7111") {
      // 施設サマリー（特に保持しない）
      continue;
    }

    if (subType === "7131-1" || subType === "71311") {
      // 入居者基本情報（被保険者番号、氏名）
      if (currentResident) {
        residents.push(currentResident);
      }
      currentResident = {
        insuranceNumber: (row[2] ?? "").trim(),
        name: (row[3] ?? "").trim(),
        services: [],
        totalUnits: 0,
        totalAmount: 0,
        insuranceCoverage: 0,
        selfPayAmount: 0,
      };
      continue;
    }

    if (subType === "7131-2" || subType === "71312") {
      // サービス明細（サービスコード6桁、回数、単位数）
      if (!currentResident) {
        warnings.push({
          line: i + 1,
          code: "ORPHAN_SERVICE",
          message: "入居者情報の前にサービス明細が出現しました",
        });
        continue;
      }
      const code = (row[2] ?? "").trim();
      const count = Number(row[3] ?? 0);
      const units = Number(row[4] ?? 0);
      if (!code) {
        warnings.push({ line: i + 1, code: "MISSING_SERVICE_CODE", message: "サービスコードが空" });
        continue;
      }
      const service: ReceiptService = {
        serviceCode: code,
        serviceName: resolveServiceName(code, master),
        count: Number.isFinite(count) ? count : 0,
        units: Number.isFinite(units) ? units : 0,
      };
      currentResident.services.push(service);
      continue;
    }

    if (subType === "7131-10" || subType === "713110") {
      // 入居者サマリー（合計単位、保険給付額、利用者負担額）
      if (!currentResident) {
        warnings.push({
          line: i + 1,
          code: "ORPHAN_SUMMARY",
          message: "入居者情報の前にサマリーが出現しました",
        });
        continue;
      }
      const totalUnits = Number(row[2] ?? 0);
      const insuranceCoverage = Number(row[3] ?? 0);
      const selfPayAmount = Number(row[4] ?? 0);

      currentResident.totalUnits = Number.isFinite(totalUnits) ? totalUnits : 0;
      currentResident.insuranceCoverage = Number.isFinite(insuranceCoverage)
        ? Math.floor(insuranceCoverage)
        : 0;
      currentResident.selfPayAmount = Number.isFinite(selfPayAmount)
        ? Math.floor(selfPayAmount)
        : 0;
      // 費用総額 = 合計単位 × 地域単価（円未満切捨て）
      currentResident.totalAmount = Math.floor(
        currentResident.totalUnits * regionalUnitPrice
      );
      continue;
    }
  }

  // ループ終端で currentResident が確定していない場合のフラッシュ
  if (currentResident) {
    residents.push(currentResident);
  }

  const data: ReceiptData = {
    facilityNumber,
    processingMonth,
    regionalUnitPrice,
    residents,
  };

  return { data, warnings };
}

/**
 * Shift-JIS バイナリ or UTF-8 文字列を UTF-8 文字列に正規化。
 */
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
