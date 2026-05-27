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
import { groupForPreview, type PreviewLine } from "@/lib/upload/preview";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_ROWS = 10_000;
const ALLOWED_MIME = new Set(["text/csv", "application/octet-stream", "text/plain"]);

const querySchema = z.object({
  // provider は自分の merchant に固定するため任意。admin/facility_staff は指定可。
  merchantId: z.string().uuid().optional(),
  uploadFormatId: z.string().uuid().optional(),
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
  const text = await file.text();

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

  // 対象施設の解決
  let facilityIds: string[] = [];
  let facilityIdForSelf: string | null = null;
  if (role === "provider") {
    facilityIds = await getActiveFacilityIdsForMerchant(admin, merchantId);
  } else if (role === "facility_staff") {
    const { data: profile } = await admin
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    facilityIdForSelf = (profile?.facility_id as string | null) ?? null;
    facilityIds = facilityIdForSelf ? [facilityIdForSelf] : [];
  } else {
    // admin: 全施設対象
    const { data: allFac } = await admin
      .from("facilities")
      .select("id")
      .is("deleted_at", null);
    facilityIds = ((allFac as Array<{ id: string }>) ?? []).map((f) => f.id);
  }

  // upload_batches INSERT
  const totalAmountAll = rows.reduce(
    (sum, r) => sum + toInt(r[mapping.amount ?? "amount"]),
    0
  );
  const { data: batch, error: batchErr } = await admin
    .from("upload_batches")
    .insert({
      merchant_id: merchantId,
      provider_type: role === "facility_staff" ? "facility_self" : "external_provider",
      file_name: fileName,
      total_rows: rows.length,
      total_amount: totalAmountAll,
      status: "processing",
    })
    .select("id")
    .single();
  if (batchErr || !batch) {
    return NextResponse.json(apiError(batchErr?.message ?? "batch insert失敗", "DB"), {
      status: 500,
    });
  }
  const batchId = batch.id as string;

  // statement_lines 構築 + マッチング
  const previewLines: PreviewLine[] = [];
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

    previewLines.push({
      statementLineId: "",
      facilityId: facilityId,
      residentId: matchResult.residentId ?? null,
      residentName: null,
      insuranceNumber: insurance,
      serviceCode: serviceCode || null,
      serviceName: serviceName || null,
      amount,
      selfPayAmount: selfPay,
      matchStatus: matchResult.status,
    });
  }

  // バルクINSERT
  const { data: inserted, error: insErr } = await admin
    .from("statement_lines")
    .insert(statementInserts)
    .select("id, facility_id, resident_id, insurance_number, match_status, amount");
  if (insErr) {
    await admin
      .from("upload_batches")
      .update({ status: "error" })
      .eq("id", batchId);
    return NextResponse.json(apiError(insErr.message, "STATEMENT_INSERT"), {
      status: 500,
    });
  }

  // preview ID 付与
  const insertedArr = (inserted as Array<{ id: string }>) ?? [];
  for (let i = 0; i < previewLines.length; i++) {
    previewLines[i].statementLineId = insertedArr[i]?.id ?? "";
  }

  // メタ取得: 関連施設・入居者の名前
  const facilityNames = new Map<string, string>();
  const residentNames = new Map<string, string>();
  if (facilityIds.length > 0) {
    const { data: facs } = await admin
      .from("facilities")
      .select("id, name")
      .in("id", facilityIds);
    for (const f of (facs as Array<{ id: string; name: string }>) ?? []) {
      facilityNames.set(f.id, f.name);
    }
  }
  const residentIds = previewLines
    .map((l) => l.residentId)
    .filter((id): id is string => !!id);
  if (residentIds.length > 0) {
    const { data: residents } = await admin
      .from("residents")
      .select("id, name_last, name_first")
      .in("id", residentIds);
    for (const r of (residents as Array<{
      id: string;
      name_last: string;
      name_first: string;
    }>) ?? []) {
      residentNames.set(r.id, `${r.name_last} ${r.name_first}`);
    }
  }

  // preview JSON 構築
  const preview = groupForPreview(batchId, previewLines, {
    facilityNames,
    residentNames,
  });

  // batches UPDATE
  await admin
    .from("upload_batches")
    .update({ status: "preview" })
    .eq("id", batchId);

  return NextResponse.json(apiOk(preview));
}

function toInt(v: string | number | undefined | null): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? Math.floor(n) : 0;
}
