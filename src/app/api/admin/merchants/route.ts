/**
 * POST /api/admin/merchants
 *
 * 加盟店を作成し、必要に応じてモールコード/端末識別番号をプールから原子的に払い出す。
 * - admin のみ
 * - プール払い出しは DB関数 assign_mall_code / assign_terminal_id（FOR UPDATE SKIP LOCKED）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  name_kana: z.string().trim().max(100).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  upload_format_id: z.string().uuid().nullable().optional(),
  assign_mall_code: z.boolean().optional(),
  assign_terminal_id: z.boolean().optional(),
});

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
  if (role !== "admin") {
    return NextResponse.json(apiError("管理者のみ実行できます", "FORBIDDEN"), { status: 403 });
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
  const v = parsed.data;

  const admin = getSupabaseAdminClient();

  // 加盟店作成
  const { data: merchant, error: insErr } = await admin
    .from("merchants")
    .insert({
      name: v.name.trim(),
      name_kana: v.name_kana?.trim() || null,
      address: v.address?.trim() || null,
      phone: v.phone?.trim() || null,
      upload_format_id: v.upload_format_id || null,
    })
    .select("id")
    .single();
  if (insErr || !merchant) {
    return NextResponse.json(apiError(insErr?.message ?? "作成に失敗しました", "DB"), {
      status: 500,
    });
  }
  const merchantId = merchant.id as string;

  let mallCode: string | null = null;
  let terminalId: string | null = null;

  // モールコード払い出し
  if (v.assign_mall_code) {
    const { data, error } = await admin.rpc("assign_mall_code", { p_merchant_id: merchantId });
    if (error) {
      return NextResponse.json(
        apiError(`モールコード払い出し失敗: ${error.message}`, "MALL_CODE"),
        { status: 409 }
      );
    }
    mallCode = data as string;
  }
  // 端末識別番号払い出し
  if (v.assign_terminal_id) {
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
