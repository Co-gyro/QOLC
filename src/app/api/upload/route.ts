/**
 * POST /api/upload
 *
 * サービス提供者・施設からの明細CSVアップロード受信エンドポイント。
 *
 * フロー:
 *   1. 認証 + ロール確認
 *   2. ファイル制約チェック（≤10MB、≤10,000行、MIMEタイプ）
 *   3. CSV パース（upload_formats.column_mapping を適用）
 *   4. upload_batches INSERT（processing）
 *   5. statement_lines バルク INSERT + 被保険者番号マッチング
 *   6. upload_batches UPDATE（preview）
 *   7. プレビュー JSON 返却（施設別→入居者別）
 */
import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeCell } from "@/lib/upload/csv-injection";
import {
  matchInsuranceNumber,
  getActiveFacilityIdsForMerchant,
} from "@/lib/upload/matcher";
import {
  detectReceiptKind,
  loadResidentsForMatching,
  persistKaigoReceipt,
  persistIryouReceipt,
  persistOtherCost,
  ensureBatch,
  recomputeBatchTotal,
  buildPreviewForBatch,
} from "@/lib/upload/receipt-flow";
import { detectOtherCostCsv } from "@/lib/receipt/other-cost-csv";
import { logActivity } from "@/lib/audit/activity-log";
import { apiError, apiOk } from "@/types/api";
import type { PreviewResult } from "@/lib/upload/preview";
import type { UserRole } from "@/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 10_000;
// CSV/XLSX/UKE を受け付け（レセプトはxlsx形式で来るため拡張）
const ALLOWED_MIME = new Set([
  "text/csv",
  "application/octet-stream",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const querySchema = z.object({
  // provider は自分の merchant に固定するため任意。admin/facility_staff は指定可。
  merchantId: z.string().uuid().optional(),
  uploadFormatId: z.string().uuid().optional(),
  // 既存バッチへ追記する場合に指定（1アップロード=1バッチに集約。create-or-append）
  batchId: z.string().uuid().optional(),
});

interface FormatMapping {
  insurance_number: string;
  service_code?: string;
  service_name?: string;
  quantity?: string;
  unit_price?: string;
  amount?: string;
  self_pay_amount?: string;
}

export async function POST(req: NextRequest) {
  // 認証
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), {
      status: 401,
    });
  }
  const role =
    (user.app_metadata?.role as UserRole | undefined) ??
    (await supabase.from("profiles").select("role").eq("id", user.id).single())
      .data?.role as UserRole | undefined;
  if (!role || !["admin", "facility_staff", "provider"].includes(role)) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), {
      status: 403,
    });
  }

  // クエリ
  const url = new URL(req.url);
  const qs = querySchema.safeParse({
    merchantId: url.searchParams.get("merchantId") ?? undefined,
    uploadFormatId: url.searchParams.get("uploadFormatId") ?? undefined,
    batchId: url.searchParams.get("batchId") ?? undefined,
  });
  if (!qs.success) {
    return NextResponse.json(apiError("クエリパラメータ不正", "VALIDATION_ERROR"), {
      status: 400,
    });
  }

  const admin = getSupabaseAdminClient();

  // merchant_id をロールに応じて安全に解決（provider は自分の加盟店に固定）
  let merchantId: string | null = null;
  if (role === "provider") {
    const { data: prof } = await admin
      .from("profiles")
      .select("merchant_id")
      .eq("id", user.id)
      .single();
    merchantId = (prof?.merchant_id as string | null) ?? null;
    if (!merchantId) {
      return NextResponse.json(
        apiError("プロフィールに加盟店が設定されていません", "NO_MERCHANT"),
        { status: 403 }
      );
    }
  } else {
    // admin / facility_staff はクエリで指定（必須）
    if (!qs.data.merchantId) {
      return NextResponse.json(
        apiError("merchantId が必要です", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }
    merchantId = qs.data.merchantId;
  }

  // multipart 受信
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(apiError("file が必要です", "BAD_REQUEST"), {
      status: 400,
    });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      apiError("ファイルサイズが上限(10MB)を超えています", "FILE_TOO_LARGE"),
      { status: 413 }
    );
  }
  const mime = (file as Blob).type;
  if (mime && !ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      apiError(`MIME タイプが許可されていません: ${mime}`, "BAD_MIME"),
      { status: 415 }
    );
  }
  const fileName = (file as File).name ?? "upload.csv";

  // ファイル種別を判定して振り分ける（1アップロード=1バッチに集約。create-or-append）:
  //   - 介護保険CSV / 医療UKE(xlsx) → レセプト永続化フロー
  //   - その他費用CSV（「その他費用」列あり）→ その他費用結合フロー（誤って①に投入されても正しく処理）
  //   - それ以外 → 独自CSVフロー（後段）
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const head = fileBuffer.slice(0, 256).toString("utf8");
  const incomingBatchId = qs.data.batchId ?? null;
  const providerType = (role === "facility_staff" ? "facility_self" : "external_provider") as
    | "facility_self"
    | "external_provider";

  // facility_staff の自施設ID（突合フォールバック用）
  let facilityIdForSelf: string | null = null;
  if (role === "facility_staff") {
    const { data: profile } = await admin
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    facilityIdForSelf = (profile?.facility_id as string | null) ?? null;
  }

  const receiptKind = detectReceiptKind(fileName, head);
  const isOtherCost = !receiptKind && detectOtherCostCsv(fileBuffer);

  if (receiptKind || isOtherCost) {
    try {
      const residentsAll = await loadResidentsForMatching(admin);
      const allFacilities = await admin.from("facilities").select("id, name").is("deleted_at", null);
      const facilityNames = new Map<string, string>();
      for (const f of (allFacilities.data as Array<{ id: string; name: string }> | null) ?? []) {
        facilityNames.set(f.id, f.name);
      }

      if (isOtherCost) {
        // その他費用CSV: 突合許可施設を解決して結合（create-or-append）
        const allowedFacilityIds = await resolveAllowedFacilityIds(admin, role, merchantId, facilityIdForSelf);
        const preview = await persistOtherCost(admin, {
          fileBuffer,
          batchId: incomingBatchId,
          merchantId,
          providerType,
          fileName,
          residents: residentsAll,
          facilityNames,
          allowedFacilityIds,
        });
        await logUpload(user.id, role, "その他費用（保険外）", fileName, preview);
        return NextResponse.json(apiOk(preview));
      }

      // 介護レセプト/医療UKE とも永続化して決済フローに乗せる（B案）。
      const persistOpts = {
        fileBuffer,
        batchId: incomingBatchId,
        merchantId,
        providerType,
        fileName,
        residents: residentsAll,
        facilityNames,
        facilityIdForSelf,
      };
      const preview =
        receiptKind === "kaigo-csv"
          ? await persistKaigoReceipt(admin, persistOpts)
          : await persistIryouReceipt(admin, persistOpts);
      await logUpload(
        user.id,
        role,
        receiptKind === "kaigo-csv" ? "介護レセプト" : "医療UKE",
        fileName,
        preview
      );
      return NextResponse.json(apiOk(preview));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      return NextResponse.json(apiError(`ファイルの処理に失敗しました: ${msg}`, "RECEIPT_PARSE"), {
        status: 400,
      });
    }
  }

  const text = fileBuffer.toString("utf8");

  // 行数チェック
  const totalLines = text.split(/\r?\n/).filter((l) => l.length > 0).length;
  if (totalLines > MAX_ROWS) {
    return NextResponse.json(
      apiError(`行数が上限(${MAX_ROWS})を超えています`, "TOO_MANY_ROWS"),
      { status: 413 }
    );
  }

  // アップロードフォーマット解決（指定 > 加盟店設定 > デフォルト）
  let mapping: FormatMapping = { insurance_number: "被保険者番号", amount: "金額" };
  let formatId = qs.data.uploadFormatId ?? null;
  if (!formatId) {
    const { data: mer } = await admin
      .from("merchants")
      .select("upload_format_id")
      .eq("id", merchantId)
      .single();
    formatId = (mer?.upload_format_id as string | null) ?? null;
  }
  if (formatId) {
    const { data: fmt } = await admin
      .from("upload_formats")
      .select("column_mapping")
      .eq("id", formatId)
      .single();
    if (fmt?.column_mapping) {
      mapping = fmt.column_mapping as FormatMapping;
    }
  }

  // CSV パース
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    return NextResponse.json(
      apiError(`CSV パースエラー: ${parsed.errors[0].message}`, "CSV_PARSE"),
      { status: 400 }
    );
  }
  const rows = parsed.data;

  // 対象施設の解決（facilityIdForSelf は上部で解決済み）
  let facilityIds: string[] = [];
  if (role === "provider") {
    facilityIds = await getActiveFacilityIdsForMerchant(admin, merchantId);
  } else if (role === "facility_staff") {
    facilityIds = facilityIdForSelf ? [facilityIdForSelf] : [];
  } else {
    // admin: 全施設対象
    const { data: allFac } = await admin
      .from("facilities")
      .select("id")
      .is("deleted_at", null);
    facilityIds = ((allFac as Array<{ id: string }>) ?? []).map((f) => f.id);
  }

  // バッチ解決（create-or-append。独自CSVも既存バッチへ追記可能）
  let batchId: string;
  try {
    batchId = await ensureBatch(admin, { batchId: incomingBatchId, merchantId, providerType, fileName });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "batch resolve失敗";
    return NextResponse.json(apiError(msg, "DB"), { status: 400 });
  }

  // statement_lines 構築 + マッチング
  const statementInserts: Array<Record<string, unknown>> = [];

  for (const row of rows) {
    const insuranceRaw = (row[mapping.insurance_number] ?? "").trim();
    const insurance = sanitizeCell(insuranceRaw);
    const amount = toInt(row[mapping.amount ?? "amount"]);
    const selfPay = toInt(row[mapping.self_pay_amount ?? "self_pay_amount"]);
    const serviceCode = sanitizeCell((row[mapping.service_code ?? "service_code"] ?? "").trim());
    const serviceName = sanitizeCell((row[mapping.service_name ?? "service_name"] ?? "").trim());

    const matchTargets = facilityIds.length > 0 ? facilityIds : [];
    let matchResult: Awaited<ReturnType<typeof matchInsuranceNumber>> = {
      status: "unmatched",
    };
    if (insurance && matchTargets.length > 0) {
      matchResult = await matchInsuranceNumber(admin, {
        insuranceNumber: insurance,
        facilityIds: matchTargets,
      });
    }

    const facilityId =
      matchResult.facilityId ??
      (role === "facility_staff" ? facilityIdForSelf : null);

    statementInserts.push({
      upload_batch_id: batchId,
      facility_id: facilityId,
      resident_id: matchResult.residentId ?? null,
      insurance_number: insurance,
      service_code: serviceCode || null,
      service_name: serviceName || null,
      amount,
      self_pay_amount: selfPay,
      match_status: matchResult.status,
    });
  }

  // バルクINSERT
  const { error: insErr } = await admin
    .from("statement_lines")
    .insert(statementInserts);
  if (insErr) {
    await admin
      .from("upload_batches")
      .update({ status: "error" })
      .eq("id", batchId);
    return NextResponse.json(apiError(insErr.message, "STATEMENT_INSERT"), {
      status: 500,
    });
  }

  // 施設名（プレビュー表示用）
  const facilityNames = new Map<string, string>();
  if (facilityIds.length > 0) {
    const { data: facs } = await admin
      .from("facilities")
      .select("id, name")
      .in("id", facilityIds);
    for (const f of (facs as Array<{ id: string; name: string }>) ?? []) {
      facilityNames.set(f.id, f.name);
    }
  }

  // 合計再計算 → 確認待ち。バッチ全体（既存その他費用も含む）を読み直して合算プレビューを返す。
  await recomputeBatchTotal(admin, batchId);
  await admin.from("upload_batches").update({ status: "preview" }).eq("id", batchId);
  const preview = await buildPreviewForBatch(admin, batchId, facilityNames);
  await logUpload(user.id, role, "明細CSV", fileName, preview);
  return NextResponse.json(apiOk(preview));
}

/** アップロードの監査ログを記録する（失敗は内部で握りつぶす） */
async function logUpload(
  userId: string,
  role: UserRole,
  kind: string,
  fileName: string,
  preview: PreviewResult
): Promise<void> {
  const matched = preview.facilities.reduce((s, f) => s + f.residents.length, 0);
  await logActivity({
    actorId: userId,
    actorRole: role,
    facilityId: preview.facilities[0]?.facilityId ?? null,
    action: "upload",
    targetType: "upload_batch",
    targetId: preview.batchId,
    targetLabel: `${kind}を取込（${matched}名マッチ）`,
    metadata: { kind, fileName, matched, totalAmount: preview.totalAmount },
  });
}

/** ロール別の突合許可施設ID（admin は null=全施設） */
async function resolveAllowedFacilityIds(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  role: UserRole,
  merchantId: string,
  facilityIdForSelf: string | null
): Promise<string[] | null> {
  if (role === "provider") return getActiveFacilityIdsForMerchant(admin, merchantId);
  if (role === "facility_staff") return facilityIdForSelf ? [facilityIdForSelf] : [];
  return null; // admin
}

function toInt(v: string | number | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? Math.floor(n) : 0;
}
