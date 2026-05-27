/**
 * POST /api/admin/merchants/[id]/assign
 *
 * 既存加盟店に対し、未割当のモールコード/端末識別番号をプールから払い出す。
 * - admin のみ
 * - 既に割当済みの場合はスキップ（二重払い出し防止）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const bodySchema = z.object({
  assign_mall_code: z.boolean().optional(),
  assign_terminal_id: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
  if (role !== "admin") {
    return NextResponse.json(apiError("管理者のみ実行できます", "FORBIDDEN"), { status: 403 });
  }

  const merchantId = params.id;
  if (!/^[0-9a-f-]{36}$/i.test(merchantId)) {
    return NextResponse.json(apiError("不正なID", "BAD_REQUEST"), { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(apiError("不正なリクエスト", "BAD_REQUEST"), { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(apiError("入力検証エラー", "VALIDATION_ERROR"), { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const { data: merchant } = await admin
    .from("merchants")
    .select("id, mall_code, terminal_id")
    .eq("id", merchantId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!merchant) {
    return NextResponse.json(apiError("加盟店が見つかりません", "NOT_FOUND"), { status: 404 });
  }

  let mallCode: string | null = (merchant.mall_code as string | null) ?? null;
  let terminalId: string | null = (merchant.terminal_id as string | null) ?? null;

  // モールコード（未割当のときのみ払い出し）
  if (parsed.data.assign_mall_code && !mallCode) {
    const { data, error } = await admin.rpc("assign_mall_code", { p_merchant_id: merchantId });
    if (error) {
      return NextResponse.json(
        apiError(`モールコード払い出し失敗: ${error.message}`, "MALL_CODE"),
        { status: 409 }
      );
    }
    mallCode = data as string;
  }
  // 端末識別番号（未割当のときのみ払い出し）
  if (parsed.data.assign_terminal_id && !terminalId) {
    const { data, error } = await admin.rpc("assign_terminal_id", { p_merchant_id: merchantId });
    if (error) {
      return NextResponse.json(
        apiError(`端末識別番号払い出し失敗: ${error.message}`, "TERMINAL_ID"),
        { status: 409 }
      );
    }
    terminalId = data as string;
  }

  return NextResponse.json(apiOk({ id: merchantId, mallCode, terminalId }));
}
