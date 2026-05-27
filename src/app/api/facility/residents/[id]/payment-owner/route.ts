/**
 * POST /api/facility/residents/[id]/payment-owner
 *
 * 支払い担当者を指定アカウントに設定/移譲する（フラグ移譲のみ）。
 * - facility_staff（自施設）/ admin
 * - 既存オーナーを解除 → 指定アカウントを設定（部分ユニーク制約を満たす順序）
 * - 旧オーナーのカード(usen_member_id)は変更しない（新オーナーは別途カード登録が必要）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const bodySchema = z.object({ accountId: z.string().uuid() });

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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
  if (role !== "facility_staff" && role !== "admin") {
    return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
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

  // 入居者と所属検証
  const { data: resident } = await admin
    .from("residents")
    .select("id, facility_id")
    .eq("id", params.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!resident) {
    return NextResponse.json(apiError("入居者が見つかりません", "NOT_FOUND"), { status: 404 });
  }
  if (role === "facility_staff") {
    const { data: prof } = await admin
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    if (prof?.facility_id !== resident.facility_id) {
      return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
    }
  }

  // 対象アカウントがこの入居者のものか検証
  const { data: account } = await admin
    .from("resident_accounts")
    .select("id, resident_id")
    .eq("id", parsed.data.accountId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!account || account.resident_id !== resident.id) {
    return NextResponse.json(apiError("対象アカウントが不正です", "BAD_ACCOUNT"), { status: 400 });
  }

  // 1) 現オーナーを解除（部分ユニーク制約のため先に false へ）
  const { error: e1 } = await admin
    .from("resident_accounts")
    .update({ is_payment_owner: false })
    .eq("resident_id", resident.id)
    .eq("is_payment_owner", true);
  if (e1) {
    return NextResponse.json(apiError(`解除に失敗しました: ${e1.message}`, "DB"), { status: 500 });
  }
  // 2) 指定アカウントをオーナーに設定
  const { error: e2 } = await admin
    .from("resident_accounts")
    .update({ is_payment_owner: true })
    .eq("id", parsed.data.accountId);
  if (e2) {
    return NextResponse.json(apiError(`設定に失敗しました: ${e2.message}`, "DB"), { status: 500 });
  }

  return NextResponse.json(apiOk({ accountId: parsed.data.accountId }));
}
