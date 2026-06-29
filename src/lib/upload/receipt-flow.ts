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
import { parseOtherCostCsv } from "@/lib/receipt/other-cost-csv";
import {
  matchKaigoReceipts,
  matchIryouReceipts,
  type ResidentForMatching,
  type FormerInsuranceNumber,
} from "@/lib/receipt/matcher";
import {
  groupForPreview,
  type PreviewLine,
  type PreviewResult,
  type PreviewFacilityGroup,
  type PreviewResidentGroup,
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
    /** 既存バッチに追記する場合に指定（未指定は新規作成）。create-or-append */
    batchId?: string | null;
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

  const batchId = await ensureBatch(admin, {
    batchId: opts.batchId,
    merchantId: opts.merchantId,
    providerType: opts.providerType,
    fileName: opts.fileName,
  });

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

  // 二重投入ガード: 同一(入居者×サービス名)の既存行を置換
  await replacePriorLines(admin, batchId, lineInserts);

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

  await recomputeBatchTotal(admin, batchId);
  // 取込完了 → 確認待ち(preview)。決済実行で completed になる。
  await admin.from("upload_batches").update({ status: "preview" }).eq("id", batchId);

  // バッチ全体（既存その他費用も含む）を読み直して合算プレビューを返す。
  return buildPreviewForBatch(admin, batchId, opts.facilityNames);
}

/**
 * 医療保険UKE(xlsx) を**永続化**して PreviewResult を返す（B案決済結線）。
 *
 * - upload_batch を作成
 * - 患者ごとに statement_lines を1行作成（amount=費用総額=HO合計金額, self_pay=本人負担）
 * - KA(算定項目)をコード別に集計し statement_service_details に保存（amount=費用円）
 */
export async function persistIryouReceipt(
  admin: SupabaseClient,
  opts: {
    fileBuffer: Buffer;
    /** 既存バッチに追記する場合に指定（未指定は新規作成）。create-or-append */
    batchId?: string | null;
    merchantId: string;
    providerType: "external_provider" | "facility_self";
    fileName: string;
    residents: ResidentWithFacility[];
    facilityNames: Map<string, string>;
    facilityIdForSelf: string | null;
  }
): Promise<PreviewResult> {
  const wb = new ExcelJS.Workbook();
  const ab = opts.fileBuffer.buffer.slice(
    opts.fileBuffer.byteOffset,
    opts.fileBuffer.byteOffset + opts.fileBuffer.byteLength
  ) as ArrayBuffer;
  await wb.xlsx.load(ab);
  const sheet = wb.worksheets[0];
  if (!sheet) return { batchId: "", facilities: [], unmatched: [], totalAmount: 0 };
  const parsed = parseIryouUke(xlsxSheetToRows(sheet));
  const matches = matchIryouReceipts(parsed.patients, opts.residents);

  // 費用総額 = HO合計金額（無ければ Σ明細費用）
  const costTotalOf = (p: (typeof matches)[number]["receipt"]) =>
    p.hoken?.totalAmount ?? p.serviceDetails.reduce((s, d) => s + d.totalAmount, 0);

  const batchId = await ensureBatch(admin, {
    batchId: opts.batchId,
    merchantId: opts.merchantId,
    providerType: opts.providerType,
    fileName: opts.fileName,
  });

  const lineInserts = matches.map((m) => {
    const p = m.receipt;
    const resident = m.resident as ResidentWithFacility | null;
    const matched = m.status === "matched" || m.status === "matched_via_history";
    return {
      upload_batch_id: batchId,
      facility_id: resident?.facilityId ?? opts.facilityIdForSelf ?? null,
      resident_id: resident?.id ?? null,
      // insurance_number は VARCHAR(10)。医療は被保険者番号のみ保持（複合キーはマッチ済）。
      insurance_number: (p.hoken?.bangou ?? "").slice(0, 10) || null,
      service_code: null,
      service_name: `医療保険 ${p.serviceMonth}`,
      amount: costTotalOf(p),
      self_pay_amount: p.userBurden,
      match_status: matched ? "matched" : "unmatched",
    };
  });

  // 二重投入ガード: 同一(入居者×サービス名)の既存行を置換
  await replacePriorLines(admin, batchId, lineInserts);

  const { data: insertedLines, error: insErr } = await admin
    .from("statement_lines")
    .insert(lineInserts)
    .select("id");
  if (insErr) {
    await admin.from("upload_batches").update({ status: "error" }).eq("id", batchId);
    throw new Error(insErr.message);
  }
  const lineIds = (insertedLines as Array<{ id: string }> | null) ?? [];

  // 算定項目明細（KA集計）を statement_service_details に保存。医療は amount(費用円)を保持。
  const detailInserts: Array<Record<string, unknown>> = [];
  matches.forEach((m, i) => {
    const lineId = lineIds[i]?.id;
    if (!lineId) return;
    m.receipt.serviceDetails.forEach((d, j) => {
      detailInserts.push({
        statement_line_id: lineId,
        service_type_code: null,
        service_item_code: d.code, // 訪問看護療養費コード(9桁)
        unit_score: 0,
        count: d.count,
        total_units: 0,
        amount: d.totalAmount, // 費用(円)
        sort_order: j,
      });
    });
  });
  if (detailInserts.length > 0) {
    const { error: dErr } = await admin.from("statement_service_details").insert(detailInserts);
    if (dErr) throw new Error(`サービス明細の保存に失敗: ${dErr.message}`);
  }

  await recomputeBatchTotal(admin, batchId);
  // 取込完了 → 確認待ち(preview)。決済実行で completed になる。
  await admin.from("upload_batches").update({ status: "preview" }).eq("id", batchId);

  // バッチ全体（既存その他費用も含む）を読み直して合算プレビューを返す。
  return buildPreviewForBatch(admin, batchId, opts.facilityNames);
}

/** 被保険者番号を突合用に正規化（前後空白除去・先頭0除去） */
function normalizeInsuranceNumber(s: string): string {
  return s.trim().replace(/^0+/, "");
}

/**
 * バッチを解決する。batchId 指定時は検証して再利用、未指定なら新規作成する。
 * 1回のアップロードセッション＝1バッチに集約するための共通処理（create-or-append）。
 *
 * @throws batchId 指定時にバッチが無い/別merchant/決済実行済み(completed)/エラー のとき
 */
export async function ensureBatch(
  admin: SupabaseClient,
  opts: {
    batchId?: string | null;
    merchantId: string;
    providerType: "external_provider" | "facility_self";
    fileName: string;
  }
): Promise<string> {
  if (opts.batchId) {
    const { data: batch } = await admin
      .from("upload_batches")
      .select("id, merchant_id, status")
      .eq("id", opts.batchId)
      .maybeSingle();
    if (!batch) throw new Error("対象のアップロードバッチが見つかりません");
    if (batch.merchant_id !== opts.merchantId) throw new Error("このバッチを操作する権限がありません");
    if (batch.status === "completed") {
      throw new Error("このバッチは決済実行済みのため、追加できません");
    }
    if (batch.status === "error") {
      throw new Error("このバッチはエラー状態のため、追加できません");
    }
    return opts.batchId;
  }
  const { data: created, error } = await admin
    .from("upload_batches")
    .insert({
      merchant_id: opts.merchantId,
      provider_type: opts.providerType,
      file_name: opts.fileName,
      total_rows: 0,
      total_amount: 0,
      status: "processing",
    })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "バッチ作成に失敗しました");
  return created.id as string;
}

/**
 * その他費用（保険外）CSVをバッチに**結合**して PreviewResult を返す（create-or-append）。
 *
 * - batchId 指定時はそのバッチへ追記、未指定なら新規バッチを作成（その他費用のみ／先行も可）。
 * - 被保険者番号で入居者へ突合し statement_lines を cost_kind='other' で追加（amount=self_pay=合計）。
 * - 既に同バッチへ取り込んだ その他費用行があれば置き換える（再アップロード冪等）。
 * - 決済は self_pay_amount を resident×merchant で合計するため、保険分と自動合算される。
 * - 領収書は cost_kind='other' を区分表示（合算）する。
 */
export async function persistOtherCost(
  admin: SupabaseClient,
  opts: {
    fileBuffer: Buffer;
    batchId?: string | null;
    merchantId: string;
    providerType: "external_provider" | "facility_self";
    fileName: string;
    residents: ResidentWithFacility[];
    facilityNames: Map<string, string>;
    /** 突合を許可する施設ID（provider/facility_staff用）。null は全施設（admin） */
    allowedFacilityIds: string[] | null;
  }
): Promise<PreviewResult> {
  const batchId = await ensureBatch(admin, {
    batchId: opts.batchId,
    merchantId: opts.merchantId,
    providerType: opts.providerType,
    fileName: opts.fileName,
  });

  const { rows } = parseOtherCostCsv(opts.fileBuffer);

  // 突合対象の入居者: 許可施設で絞り、被保険者番号で索引
  const allowed = opts.allowedFacilityIds;
  const byNumber = new Map<string, ResidentWithFacility>();
  for (const r of opts.residents) {
    if (!r.insuranceNumber) continue;
    if (allowed && (!r.facilityId || !allowed.includes(r.facilityId))) continue;
    byNumber.set(normalizeInsuranceNumber(r.insuranceNumber), r);
  }

  // 既存の その他費用行を削除（再アップロード冪等）
  await admin
    .from("statement_lines")
    .delete()
    .eq("upload_batch_id", batchId)
    .eq("cost_kind", "other");

  const inserts = rows.map((row) => {
    const resident = byNumber.get(normalizeInsuranceNumber(row.insuranceNumber)) ?? null;
    const matched = Boolean(resident);
    return {
      upload_batch_id: batchId,
      facility_id: resident?.facilityId ?? null,
      resident_id: resident?.id ?? null,
      insurance_number: row.insuranceNumber.slice(0, 10),
      service_code: null,
      service_name: "その他費用（保険外）",
      amount: row.total,
      self_pay_amount: row.total,
      match_status: matched ? "matched" : "unmatched",
      cost_kind: "other",
      tax_10_amount: row.tax10,
      tax_8_amount: row.tax8,
    };
  });
  if (inserts.length > 0) {
    const { error: insErr } = await admin.from("statement_lines").insert(inserts);
    if (insErr) throw new Error(`その他費用の保存に失敗: ${insErr.message}`);
  }

  await recomputeBatchTotal(admin, batchId);
  await admin.from("upload_batches").update({ status: "preview" }).eq("id", batchId);

  return buildPreviewForBatch(admin, batchId, opts.facilityNames);
}

/** バッチの total_amount を statement_lines の self_pay 合計で再計算する */
/**
 * 同一バッチ内の重複行を置換する（二重投入ガード）。
 * 追記する明細と (resident_id × service_name) が一致する既存行を削除してから挿入することで、
 * 同じレセプトを誤って二重投入しても重複計上（＝二重課金）を防ぐ。
 * service_name に種別＋年月が入る（例「介護保険 202604」）ため、介護と医療、別月は共存する。
 */
async function replacePriorLines(
  admin: SupabaseClient,
  batchId: string,
  newLines: Array<{ resident_id: string | null; service_name: string | null }>
): Promise<void> {
  const residentIds = Array.from(new Set(newLines.map((l) => l.resident_id).filter((x): x is string => !!x)));
  const serviceNames = Array.from(new Set(newLines.map((l) => l.service_name).filter((x): x is string => !!x)));
  if (residentIds.length === 0 || serviceNames.length === 0) return;
  const { data: prior } = await admin
    .from("statement_lines")
    .select("id")
    .eq("upload_batch_id", batchId)
    .in("resident_id", residentIds)
    .in("service_name", serviceNames);
  const ids = ((prior ?? []) as Array<{ id: string }>).map((p) => p.id);
  if (ids.length === 0) return;
  await admin.from("statement_service_details").delete().in("statement_line_id", ids);
  await admin.from("statement_lines").delete().in("id", ids);
}

export async function recomputeBatchTotal(admin: SupabaseClient, batchId: string): Promise<void> {
  const { data } = await admin
    .from("statement_lines")
    .select("self_pay_amount, amount")
    .eq("upload_batch_id", batchId);
  const lines = (data as Array<{ self_pay_amount: number | null; amount: number | null }> | null) ?? [];
  const total = lines.reduce((s, l) => s + (l.self_pay_amount ?? l.amount ?? 0), 0);
  await admin.from("upload_batches").update({ total_amount: total }).eq("id", batchId);
}

/**
 * 既存バッチの statement_lines を読み直して PreviewResult を再構築する。
 * 各行の表示額は self_pay_amount（＝決済対象額）を用いる。
 */
export async function buildPreviewForBatch(
  admin: SupabaseClient,
  batchId: string,
  facilityNames: Map<string, string>
): Promise<PreviewResult> {
  const { data } = await admin
    .from("statement_lines")
    .select(
      "id, facility_id, resident_id, insurance_number, service_code, service_name, amount, self_pay_amount, match_status, cost_kind"
    )
    .eq("upload_batch_id", batchId)
    .order("cost_kind", { ascending: true });

  type Row = {
    id: string;
    facility_id: string | null;
    resident_id: string | null;
    insurance_number: string | null;
    service_code: string | null;
    service_name: string | null;
    amount: number | null;
    self_pay_amount: number | null;
    match_status: PreviewLine["matchStatus"];
  };
  const rows = ((data ?? []) as unknown) as Row[];

  // 入居者名を取得
  const residentIds = Array.from(
    new Set(rows.map((r) => r.resident_id).filter((id): id is string => !!id))
  );
  const residentNames = new Map<string, string>();
  if (residentIds.length > 0) {
    const { data: rs } = await admin
      .from("residents")
      .select("id, name_last, name_first")
      .in("id", residentIds);
    for (const r of (rs as Array<{ id: string; name_last: string; name_first: string }> | null) ?? []) {
      residentNames.set(r.id, `${r.name_last} ${r.name_first}`);
    }
  }

  const lines: PreviewLine[] = rows.map((r) => ({
    statementLineId: r.id,
    facilityId: r.facility_id,
    residentId: r.resident_id,
    residentName: r.resident_id ? residentNames.get(r.resident_id) ?? null : null,
    insuranceNumber: r.insurance_number ?? "",
    serviceCode: r.service_code,
    serviceName: r.service_name,
    amount: r.self_pay_amount ?? r.amount ?? 0,
    selfPayAmount: r.self_pay_amount ?? 0,
    matchStatus: r.match_status,
  }));

  return groupForPreview(batchId, lines, { facilityNames, residentNames });
}

/**
 * 医療保険UKE(xlsx) をパースして PreviewResult を返す（読み取り専用・旧）。
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
