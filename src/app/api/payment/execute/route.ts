/**
 * POST /api/payment/execute
 *
 * UploadBatch に対する一括決済実行。
 * - 認証必須（admin / facility_staff / provider）
 * - バッチが confirmed 状態であること
 * - payment-service.processBatch を呼び出す
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    return NextResponse.json(apiError("認証されていません", "UNAUTHORIZED"), {
      status: 401,
    });
  }

  // ロール取得
  const role =
    (user.app_metadata?.role as UserRole | undefined) ??
    (await supabase.from("profiles").select("role").eq("id", user.id).single())
      .data?.role as UserRole | undefined;

  if (!role || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), {
      status: 403,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), {
      status: 400,
    });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      apiError("入力検証エラー", "VALIDATION_ERROR"),
      { status: 400 }
    );
  }

  try {
    const result = await processBatch({
      uploadBatchId: parsed.data.uploadBatchId,
      performedBy: user.id,
      ipAddress: req.headers.get("x-forwarded-for") ?? null,
    });
    return NextResponse.json(apiOk(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(apiError(msg, "PROCESS_FAILED"), { status: 500 });
  }
}
