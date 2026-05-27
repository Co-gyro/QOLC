/**
 * POST /api/payment/execute
 *
 * UploadBatch に対する一括決済実行。
 * - 認証必須（admin / facility_staff / provider）
 * - 認可: provider は自分の加盟店のバッチのみ。facility_staff は紐づく加盟店のバッチのみ
 * - 二重実行防止: 既に completed のバッチは再実行不可
 * - payment-service.processBatch を呼び出し、終了後にバッチを completed に更新
 *
 * 注: カード未登録(usen_member_id なし)の入居者は USEN を呼ばず status=pending（保留）となる。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { processBatch } from "@/lib/payment/payment-service";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const requestSchema = z.object({
  uploadBatchId: z.string().uuid(),
});

const ALLOWED_ROLES: UserRole[] = ["admin", "facility_staff", "provider"];

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
    ((await supabase.from("profiles").select("role").eq("id", user.id).single())
      .data?.role as UserRole | undefined);
  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  // バッチ取得
  const { data: batch } = await admin
    .from("upload_batches")
    .select("id, merchant_id, status")
    .eq("id", parsed.data.uploadBatchId)
    .maybeSingle();
  if (!batch) {
    return NextResponse.json(apiError("バッチが見つかりません", "NOT_FOUND"), { status: 404 });
  }

  // 認可: provider は自分の加盟店のバッチのみ
  if (role === "provider") {
    const { data: prof } = await admin
      .from("profiles")
      .select("merchant_id")
      .eq("id", user.id)
      .single();
    if (!prof?.merchant_id || prof.merchant_id !== batch.merchant_id) {
      return NextResponse.json(apiError("このバッチを実行する権限がありません", "FORBIDDEN"), {
        status: 403,
      });
    }
  } else if (role === "facility_staff") {
    const { data: prof } = await admin
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    const { data: rel } = await admin
      .from("facility_merchant_relations")
      .select("id")
      .eq("merchant_id", batch.merchant_id)
      .eq("facility_id", prof?.facility_id ?? "")
      .eq("status", "active")
      .maybeSingle();
    if (!rel) {
      return NextResponse.json(apiError("このバッチを実行する権限がありません", "FORBIDDEN"), {
        status: 403,
      });
    }
  }

  // 二重実行防止
  if (batch.status === "completed") {
    return NextResponse.json(apiError("このバッチは既に決済実行済みです", "ALREADY_EXECUTED"), {
      status: 409,
    });
  }

  try {
    const result = await processBatch({
      uploadBatchId: parsed.data.uploadBatchId,
      performedBy: user.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    });
    // バッチを完了状態に更新
    await admin
      .from("upload_batches")
      .update({ status: "completed" })
      .eq("id", parsed.data.uploadBatchId);
    return NextResponse.json(apiOk(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    await admin
      .from("upload_batches")
      .update({ status: "error" })
      .eq("id", parsed.data.uploadBatchId);
    return NextResponse.json(apiError(msg, "PROCESS_FAILED"), { status: 500 });
  }
}
