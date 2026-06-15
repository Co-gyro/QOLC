/**
 * レセプトファイル(介護保険CSV / 医療保険UKE)のアップロード処理を、
 * 既存 /api/upload と同じ PreviewResult 形式に変換する統合層。
 *
 * 設計方針（時間制約下のMVP）:
 *   - statement_lines への保存は **行わない**（既存フローはmerchant単位だがレセプト
 *     は事業所単位で構造が異なるため）。プレビュー返却のみ。
 *   - 決済実行は当面 /api/payment/execute からは呼べない（別途設計）。
 *   - フロントは既存の preview 表示を再利用できる。
 *
 * ファイル種別判定:
 *   - 拡張子 .xlsx → 医療保険UKE
 *   - 拡張子 .csv で先頭バイトが '"1",' で始まる → 介護保険CSV (国保連統一仕様)
 *   - それ以外 → 既存独自CSVフロー
 */
import ExcelJS from "exceljs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseKaigoCsv } from "@/lib/receipt/kaigo-csv";
import { parseIryouUke, xlsxSheetToRows } from "@/lib/receipt/iryou-uke";
import {
  matchKaigoReceipts,
  matchIryouReceipts,
  type ResidentForMatching,
  type FormerInsuranceNumber,
} from "@/lib/receipt/matcher";
import type {
  PreviewLine,
  PreviewResult,
  PreviewFacilityGroup,
  PreviewResidentGroup,
} from "./preview";

/** マッチング対象 + 施設ID を持つ拡張型 */
export type ResidentWithFacility = ResidentForMatching & {
  facilityId: string | null;
};

export type ReceiptFileKind = "kaigo-csv" | "iryou-uke" | null;

/**
 * ファイル種別を判定する。
 *
 * @param fileName 元ファイル名（拡張子判定用）
 * @param head バイト/文字の先頭サンプル（内容判定用、最大256B程度）
 */
export function detectReceiptKind(fileName: string, head: string): ReceiptFileKind {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".xlsx") || lowerName.endsWith(".uke")) {
    return "iryou-uke";
  }
  if (lowerName.endsWith(".csv")) {
    // 国保連統一仕様CSVの先頭はコントロールレコード "1","..." で始まる
    const trimmed = head.trimStart();
    if (trimmed.startsWith('"1",') || trimmed.startsWith('"1"')) {
      return "kaigo-csv";
    }
  }
  return null;
}

/** Supabase admin client から residents を取得して matcher 形式に変換する */
export async function loadResidentsForMatching(
  admin: SupabaseClient
): Promise<ResidentWithFacility[]> {
  const { data } = await admin
    .from("residents")
    .select(
      "id, name_last, name_first, insurance_number, iryou_hokensha_bangou, iryou_hihokensha_kigou, iryou_hihokensha_bangou, iryou_hihokensha_edaban, former_insurance_numbers, facility_id"
    )
    .is("deleted_at", null);

  type Raw = {
    id: string;
    name_last: string;
    name_first: string;
    insurance_number: string | null;
    iryou_hokensha_bangou: string | null;
    iryou_hihokensha_kigou: string | null;
    iryou_hihokensha_bangou: string | null;
    iryou_hihokensha_edaban: string | null;
    former_insurance_numbers: FormerInsuranceNumber[] | null;
    facility_id: string | null;
  };

  const rows = ((data ?? []) as unknown) as Raw[];
  return rows.map((r) => ({
    id: r.id,
    nameLast: r.name_last,
    nameFirst: r.name_first,
    insuranceNumber: r.insurance_number,
    iryouHokenshaBangou: r.iryou_hokensha_bangou,
    iryouHihokenshaKigou: r.iryou_hihokensha_kigou,
    iryouHihokenshaBangou: r.iryou_hihokensha_bangou,
    iryouHihokenshaEdaban: r.iryou_hihokensha_edaban,
    formerInsuranceNumbers: r.former_insurance_numbers ?? [],
    facilityId: r.facility_id,
  }));
}

/**
 * 介護保険給付費請求情報CSVをパースして PreviewResult を返す。
 */
export async function buildKaigoPreview(
  fileBuffer: Buffer,
  residents: ResidentWithFacility[],
  facilityNames: Map<string, string>,
  batchId: string
): Promise<PreviewResult> {
  const parsed = parseKaigoCsv(fileBuffer);
  const matches = matchKaigoReceipts(parsed.residents, residents);

  const lines: PreviewLine[] = matches.map((m) => {
    const r = m.receipt;
    const resident = m.resident as ResidentWithFacility | null;
    return {
      statementLineId: `kaigo-${r.insuranceNumber}`,
      facilityId: resident?.facilityId ?? null,
      residentId: resident?.id ?? null,
      residentName: resident ? `${resident.nameLast} ${resident.nameFirst}` : null,
      insuranceNumber: r.insuranceNumber,
      serviceCode: null,
      serviceName: `介護保険 ${r.serviceMonth}`,
      amount: r.userBurden,
      selfPayAmount: r.userBurden,
      matchStatus:
        m.status === "matched" || m.status === "matched_via_history" ? "matched" : "unmatched",
    };
  });

  return groupByFacility(batchId, lines, facilityNames);
}

/**
 * 医療保険UKE(xlsx) をパースして PreviewResult を返す。
 */
export async function buildIryouPreview(
  fileBuffer: Buffer,
  residents: ResidentWithFacility[],
  facilityNames: Map<string, string>,
  batchId: string
): Promise<PreviewResult> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS の型定義が Node の Buffer と一部不整合のため、ArrayBuffer 経由で渡す
  const ab = fileBuffer.buffer.slice(
    fileBuffer.byteOffset,
    fileBuffer.byteOffset + fileBuffer.byteLength
  ) as ArrayBuffer;
  await wb.xlsx.load(ab);
  const sheet = wb.worksheets[0];
  if (!sheet) {
    return { batchId, facilities: [], unmatched: [], totalAmount: 0 };
  }
  const rows = xlsxSheetToRows(sheet);
  const parsed = parseIryouUke(rows);
  const matches = matchIryouReceipts(parsed.patients, residents);

  const lines: PreviewLine[] = matches.map((m) => {
    const p = m.receipt;
    const resident = m.resident as ResidentWithFacility | null;
    const ho = p.hoken;
    const insuranceNumber = ho
      ? [ho.hokenshaNumber, ho.kigou, ho.bangou].filter(Boolean).join("/")
      : `(公費単独) ${p.kofu[0]?.futanshaNumber ?? ""}`;
    return {
      statementLineId: `iryou-${p.seq}`,
      facilityId: resident?.facilityId ?? null,
      residentId: resident?.id ?? null,
      residentName: resident
        ? `${resident.nameLast} ${resident.nameFirst}`
        : p.name || null,
      insuranceNumber,
      serviceCode: null,
      serviceName: `医療保険 ${p.serviceMonth}`,
      amount: p.userBurden,
      selfPayAmount: p.userBurden,
      matchStatus:
        m.status === "matched" || m.status === "matched_via_history" ? "matched" : "unmatched",
    };
  });

  return groupByFacility(batchId, lines, facilityNames);
}

/** PreviewLine[] を施設別にグルーピング（既存 groupForPreview の簡易版） */
function groupByFacility(
  batchId: string,
  lines: PreviewLine[],
  facilityNames: Map<string, string>
): PreviewResult {
  const facilities = new Map<string, PreviewFacilityGroup>();
  const unmatched: PreviewLine[] = [];

  for (const line of lines) {
    if (line.matchStatus !== "matched" || !line.facilityId || !line.residentId) {
      unmatched.push(line);
      continue;
    }
    let fg = facilities.get(line.facilityId);
    if (!fg) {
      fg = {
        facilityId: line.facilityId,
        facilityName: facilityNames.get(line.facilityId) ?? "(不明施設)",
        residents: [],
        unmatched: [],
        totalAmount: 0,
      };
      facilities.set(line.facilityId, fg);
    }
    let rg: PreviewResidentGroup | undefined = fg.residents.find(
      (r) => r.residentId === line.residentId
    );
    if (!rg) {
      rg = {
        residentId: line.residentId,
        residentName: line.residentName ?? "(不明)",
        totalAmount: 0,
        lines: [],
      };
      fg.residents.push(rg);
    }
    rg.lines.push(line);
    rg.totalAmount += line.amount;
    fg.totalAmount += line.amount;
  }

  const total =
    unmatched.reduce((s, l) => s + l.amount, 0) +
    Array.from(facilities.values()).reduce((s, f) => s + f.totalAmount, 0);

  return {
    batchId,
    facilities: Array.from(facilities.values()),
    unmatched,
    totalAmount: total,
  };
}
