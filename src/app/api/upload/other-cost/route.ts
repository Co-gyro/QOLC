/**
 * POST /api/upload/other-cost?batchId=...
 *
 * 既存のアップロードバッチ（レセプト/明細で作成済み・未実行）に、
 * 「その他費用（保険外）」CSVを被保険者番号で突合して結合する。
 *
 * フロー:
 *   1. 認証 + ロール確認（admin / facility_staff / provider）
 *   2. ファイル制約チェック（≤10MB、MIMEタイプ）
 *   3. merchant_id をロールに応じて安全に解決（provider は自分の加盟店に固定）
 *   4. 突合許可施設を解決（provider=取引先施設 / facility_staff=自施設 / admin=全施設）
 *   5. persistOtherCost: cost_kind='other' で statement_lines を追加し、更新後プレビュー返却
 *
 * 決済額・領収書ともに保険分と自動合算される（self_pay_amount を集約）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getActiveFacilityIdsForMerchant } from "@/lib/upload/matcher";
import { loadResidentsForMatching, persistOtherCost } from "@/lib/upload/receipt-flow";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME = new Set([
  "text/csv",
  "application/octet-stream",
  "text/plain",
  "application/vnd.ms-excel",
]);

const querySchema = z.object({ batchId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), { status: 401 });
  }
  const role =
    (user.app_metadata?.role as UserRole | undefined) ??
    ((await supabase.from("profiles").select("role").eq("id", user.id).single()).data?.role as
      | UserRole
      | undefined);
  if (!role || !["admin", "facility_staff", "provider"].includes(role)) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }

  const url = new URL(req.url);
  const qs = querySchema.safeParse({ batchId: url.searchParams.get("batchId") ?? undefined });
  if (!qs.success) {
    return NextResponse.json(apiError("batchId が必要です", "VALIDATION_ERROR"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // merchant_id 解決（provider は自分の加盟店に固定）
  let merchantId: string | null = null;
  if (role === "provider") {
    const { data: prof } = await admin
      .from("profiles")
      .select("merchant_id")
      .eq("id", user.id)
      .single();
    merchantId = (prof?.merchant_id as string | null) ?? null;
    if (!merchantId) {
      return NextResponse.json(apiError("プロフィールに加盟店が設定されていません", "NO_MERCHANT"), { status: 403 });
    }
  } else {
    // admin / facility_staff はバッチの merchant に従う（バッチから取得）
    const { data: batch } = await admin
      .from("upload_batches")
      .select("merchant_id")
      .eq("id", qs.data.batchId)
      .maybeSingle();
    merchantId = (batch?.merchant_id as string | null) ?? null;
    if (!merchantId) {
      return NextResponse.json(apiError("対象のバッチが見つかりません", "NOT_FOUND"), { status: 404 });
    }
  }

  // ファイル受信
  const form = await req.formData();
  const file = form.get("file");
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(apiError("file が必要です", "BAD_REQUEST"), { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(apiError("ファイルサイズが上限(10MB)を超えています", "FILE_TOO_LARGE"), { status: 413 });
  }
  const mime = (file as Blob).type;
  if (mime && !ALLOWED_MIME.has(mime)) {
    return NextResponse.json(apiError(`MIME タイプが許可されていません: ${mime}`, "BAD_MIME"), { status: 415 });
  }
  const fileBuffer = Buffer.from(await file.arrayBuffer());

  // 突合許可施設
  let allowedFacilityIds: string[] | null = null;
  if (role === "provider") {
    allowedFacilityIds = await getActiveFacilityIdsForMerchant(admin, merchantId);
  } else if (role === "facility_staff") {
    const { data: profile } = await admin
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    const fid = (profile?.facility_id as string | null) ?? null;
    allowedFacilityIds = fid ? [fid] : [];
  } // admin は null（全施設）

  // 施設名 + 入居者
  const residents = await loadResidentsForMatching(admin);
  const { data: facs } = await admin.from("facilities").select("id, name").is("deleted_at", null);
  const facilityNames = new Map<string, string>();
  for (const f of (facs as Array<{ id: string; name: string }> | null) ?? []) {
    facilityNames.set(f.id, f.name);
  }

  try {
    const preview = await persistOtherCost(admin, {
      fileBuffer,
      batchId: qs.data.batchId,
      merchantId,
      residents,
      facilityNames,
      allowedFacilityIds,
    });
    return NextResponse.json(apiOk(preview));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(apiError(`その他費用の取り込みに失敗しました: ${msg}`, "OTHER_COST"), { status: 400 });
  }
}
