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
 * 介護保険給付費請求情報CSVを**永続化**して PreviewResult を返す（B案決済結線）。
 *
 * - upload_batch を作成
 * - 利用者ごとに statement_lines を1行作成（amount=費用総額, self_pay=利用者負担額）
 * - 区分02のサービス明細を statement_service_details に保存（明細書ページ用）
 *
 * これにより既存の「プレビュー→決済実行(processBatch)→領収書」フローに乗る。
 */
export async function persistKaigoReceipt(
  admin: SupabaseClient,
  opts: {
    fileBuffer: Buffer;
    merchantId: string;
    providerType: "external_provider" | "facility_self";
    fileName: string;
    residents: ResidentWithFacility[];
    facilityNames: Map<string, string>;
    facilityIdForSelf: string | null;
  }
): Promise<PreviewResult> {
  const parsed = parseKaigoCsv(opts.fileBuffer);
  const matches = matchKaigoReceipts(parsed.residents, opts.residents);

  const totalAmount = matches.reduce(
    (s, m) => s + (m.receipt.insuranceClaim + m.receipt.userBurden),
    0
  );

  const { data: batch, error: batchErr } = await admin
    .from("upload_batches")
    .insert({
      merchant_id: opts.merchantId,
      provider_type: opts.providerType,
      file_name: opts.fileName,
      total_rows: matches.length,
      total_amount: totalAmount,
      status: "processing",
    })
    .select("id")
    .single();
  if (batchErr || !batch) throw new Error(batchErr?.message ?? "batch insert失敗");
  const batchId = batch.id as string;

  // statement_lines（利用者1人=1行。費用総額/利用者負担額をそのまま保持）
  const lineInserts = matches.map((m) => {
    const r = m.receipt;
    const resident = m.resident as ResidentWithFacility | null;
    const matched = m.status === "matched" || m.status === "matched_via_history";
    return {
      upload_batch_id: batchId,
      facility_id: resident?.facilityId ?? opts.facilityIdForSelf ?? null,
      resident_id: resident?.id ?? null,
      insurance_number: r.insuranceNumber,
      service_code: null,
      service_name: `介護保険 ${r.serviceMonth}`,
      amount: r.insuranceClaim + r.userBurden,
      self_pay_amount: r.userBurden,
      match_status: matched ? "matched" : "unmatched",
    };
  });

  const { data: insertedLines, error: insErr } = await admin
    .from("statement_lines")
    .insert(lineInserts)
    .select("id");
  if (insErr) {
    await admin.from("upload_batches").update({ status: "error" }).eq("id", batchId);
    throw new Error(insErr.message);
  }
  const lineIds = (insertedLines as Array<{ id: string }> | null) ?? [];

  // 区分02 サービス明細を各 statement_line に紐づけて保存
  const detailInserts: Array<Record<string, unknown>> = [];
  matches.forEach((m, i) => {
    const lineId = lineIds[i]?.id;
    if (!lineId) return;
    m.receipt.serviceDetails.forEach((d, j) => {
      detailInserts.push({
        statement_line_id: lineId,
        service_type_code: d.serviceTypeCode,
        service_item_code: d.serviceItemCode,
        unit_score: d.unitScore,
        count: d.count,
        total_units: d.totalUnits,
        sort_order: j,
      });
    });
  });
  if (detailInserts.length > 0) {
    const { error: dErr } = await admin
      .from("statement_service_details")
      .insert(detailInserts);
    if (dErr) throw new Error(`サービス明細の保存に失敗: ${dErr.message}`);
  }

  const previewLines: PreviewLine[] = matches.map((m, i) => {
    const r = m.receipt;
    const resident = m.resident as ResidentWithFacility | null;
    return {
      statementLineId: lineIds[i]?.id ?? "",
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

  return groupByFacility(batchId, previewLines, opts.facilityNames);
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
