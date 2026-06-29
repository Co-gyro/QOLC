/**
 * GET /api/upload/[batchId]
 *
 * アップロードバッチ1件の詳細（メタ情報＋施設・入居者別の明細プレビュー）を返す。
 * 履歴一覧から行をクリックして中身を確認するために使う。
 *
 * 認可:
 *   - admin          : 全件
 *   - provider       : 自加盟店(merchant)のバッチのみ
 *   - facility_staff : 自施設の明細を含むバッチのみ
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildPreviewForBatch } from "@/lib/upload/receipt-flow";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: { batchId: string } }
) {
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
  if (!role) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }

  const admin = getSupabaseAdminClient();
  const { data: batch } = await admin
    .from("upload_batches")
    .select("id, merchant_id, provider_type, file_name, status, total_amount, total_rows, created_at")
    .eq("id", params.batchId)
    .maybeSingle();
  if (!batch) {
    return NextResponse.json(apiError("バッチが見つかりません", "NOT_FOUND"), { status: 404 });
  }

  // 認可
  const authorized = await isAuthorized(admin, role, user.id, params.batchId, batch.merchant_id as string);
  if (!authorized) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }

  // 施設名 + 明細プレビュー（保険分/その他費用を含む全行）
  const { data: facs } = await admin.from("facilities").select("id, name").is("deleted_at", null);
  const facilityNames = new Map<string, string>();
  for (const f of (facs as Array<{ id: string; name: string }> | null) ?? []) {
    facilityNames.set(f.id, f.name);
  }
  const preview = await buildPreviewForBatch(admin, params.batchId, facilityNames);

  return NextResponse.json(
    apiOk({
      batch: {
        id: batch.id,
        fileName: batch.file_name,
        providerType: batch.provider_type,
        status: batch.status,
        totalAmount: batch.total_amount ?? 0,
        totalRows: batch.total_rows ?? 0,
        createdAt: batch.created_at,
      },
      preview,
    })
  );
}

/** ロール別の認可判定 */
async function isAuthorized(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  role: UserRole,
  userId: string,
  batchId: string,
  merchantId: string
): Promise<boolean> {
  if (role === "admin") return true;
  if (role === "provider") {
    const { data: prof } = await admin.from("profiles").select("merchant_id").eq("id", userId).single();
    return prof?.merchant_id === merchantId;
  }
  if (role === "facility_staff") {
    const { data: prof } = await admin.from("profiles").select("facility_id").eq("id", userId).single();
    const facilityId = prof?.facility_id as string | null;
    if (!facilityId) return false;
    // 自施設の明細を含むバッチのみ閲覧可
    const { count } = await admin
      .from("statement_lines")
      .select("id", { count: "exact", head: true })
      .eq("upload_batch_id", batchId)
      .eq("facility_id", facilityId);
    return (count ?? 0) > 0;
  }
  return false;
}
