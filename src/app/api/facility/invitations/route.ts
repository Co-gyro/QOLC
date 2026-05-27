/**
 * POST /api/facility/invitations
 *
 * 入居者の家族招待を発行する（facility_staff / admin）。
 * - 入居者が自施設に属することを検証
 * - セキュアなトークンを生成して invitations に保存
 * - 招待URL を返す（フロントで QR 表示）
 */
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const bodySchema = z.object({
  residentId: z.string().uuid(),
  accountType: z.enum(["self", "family"]).default("family"),
  isPaymentOwner: z.boolean().default(false),
  email: z.string().email().optional().or(z.literal("")),
});

const EXPIRY_DAYS = 14;

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

  // 入居者と施設の取得・所属検証
  const { data: resident } = await admin
    .from("residents")
    .select("id, facility_id")
    .eq("id", parsed.data.residentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!resident) {
    return NextResponse.json(apiError("入居者が見つかりません", "NOT_FOUND"), { status: 404 });
  }

  // facility_staff は自施設の入居者のみ
  if (role === "facility_staff") {
    const { data: prof } = await admin
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    if (prof?.facility_id !== resident.facility_id) {
      return NextResponse.json(apiError("この入居者の招待を発行する権限がありません", "FORBIDDEN"), {
        status: 403,
      });
    }
  }

  // 支払いオーナー招待の場合、既にオーナーが居れば拒否
  if (parsed.data.isPaymentOwner) {
    const { data: owner } = await admin
      .from("resident_accounts")
      .select("id")
      .eq("resident_id", resident.id)
      .eq("is_payment_owner", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (owner) {
      return NextResponse.json(
        apiError("この入居者には既に支払い担当者が登録されています", "OWNER_EXISTS"),
        { status: 409 }
      );
    }
  }

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("invitations").insert({
    resident_id: resident.id,
    facility_id: resident.facility_id,
    token,
    account_type: parsed.data.accountType,
    is_payment_owner: parsed.data.isPaymentOwner,
    email: parsed.data.email || null,
    expires_at: expiresAt,
    created_by: user.id,
  });
  if (error) {
    return NextResponse.json(apiError(`招待の作成に失敗しました: ${error.message}`, "DB"), {
      status: 500,
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${baseUrl}/invite/${token}`;
  return NextResponse.json(apiOk({ token, url, expiresAt }));
}
