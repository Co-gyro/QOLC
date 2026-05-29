/**
 * POST /api/payment/[id]/cancel
 *
 * 決済の取消/返金。action により USEN APIを使い分ける。
 *   - void   : 与信取消（authorized のみ） → /auth/void
 *   - cancel : 売上取消（captured・同一締め内） → /sales/salescancel
 *   - return : 返金（captured・締め後） → /sales/salesreturn
 *
 * 認可: admin / provider(自加盟店) / facility_staff(自施設の入居者)
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { authVoid, salesCancel, salesReturn } from "@/lib/payment/member-api";
import { isOk } from "@/lib/payment/usen-client";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

const bodySchema = z.object({ action: z.enum(["void", "cancel", "return"]) });

/** ISO日時(captured_at等) を USEN仕様の yyyy/MM/dd に変換 */
function toUsenDate(iso: string): string {
  // 文字列の先頭10文字 (yyyy-mm-dd) をスラッシュ区切りに置換するだけ。
  // タイムゾーン依存を避け、DBに保存されている日付をそのまま使う。
  return iso.slice(0, 10).replace(/-/g, "/");
}

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
  if (!role || !["admin", "facility_staff", "provider"].includes(role)) {
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
  const { data: payment } = await admin
    .from("payments")
    .select("id, merchant_id, resident_id, total_amount, payment_status, usen_jutyu_cd, captured_at, authorized_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json(apiError("決済が見つかりません", "NOT_FOUND"), { status: 404 });
  }

  // 認可
  if (role === "provider") {
    const { data: prof } = await admin.from("profiles").select("merchant_id").eq("id", user.id).single();
    if (prof?.merchant_id !== payment.merchant_id) {
      return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
    }
  } else if (role === "facility_staff") {
    const { data: prof } = await admin.from("profiles").select("facility_id").eq("id", user.id).single();
    const { data: resident } = await admin
      .from("residents")
      .select("facility_id")
      .eq("id", payment.resident_id)
      .single();
    if (!prof?.facility_id || resident?.facility_id !== prof.facility_id) {
      return NextResponse.json(apiError("権限がありません", "FORBIDDEN"), { status: 403 });
    }
  }

  if (!payment.usen_jutyu_cd) {
    return NextResponse.json(apiError("決済（受注コード）が未確定のため取消できません", "NO_JUTYU_CD"), {
      status: 409,
    });
  }

  const status = payment.payment_status as string;
  const action = parsed.data.action;

  // 状態と操作の整合性チェック
  if (action === "void" && status !== "authorized") {
    return NextResponse.json(apiError("与信取消は与信済みの決済のみ可能です", "BAD_STATE"), { status: 409 });
  }
  if ((action === "cancel" || action === "return") && status !== "captured") {
    return NextResponse.json(apiError("売上取消/返金は売上計上済みの決済のみ可能です", "BAD_STATE"), { status: 409 });
  }

  const ctx = {
    paymentId: payment.id as string,
    performedBy: user.id,
    ipAddress: req.headers.get("x-forwarded-for") ?? null,
  };
  const jutyuCd = payment.usen_jutyu_cd as string;
  const amount = payment.total_amount as number;

  // salescancel/salesreturn は元決済の売上計上日(captured_at)と一致する sales_day が必須
  const salesDay = payment.captured_at
    ? toUsenDate(payment.captured_at as string)
    : null;

  try {
    let res;
    let newStatus: string;
    let stampCol: string;
    if (action === "void") {
      res = await authVoid({ jutyuCd, amount }, ctx);
      newStatus = "cancelled";
      stampCol = "cancelled_at";
    } else if (action === "cancel") {
      if (!salesDay) {
        return NextResponse.json(apiError("売上計上日が記録されていません", "NO_CAPTURED_AT"), { status: 409 });
      }
      res = await salesCancel({ jutyuCd, amount, salesDay }, ctx);
      newStatus = "cancelled";
      stampCol = "cancelled_at";
    } else {
      if (!salesDay) {
        return NextResponse.json(apiError("売上計上日が記録されていません", "NO_CAPTURED_AT"), { status: 409 });
      }
      res = await salesReturn({ jutyuCd, amount, salesDay }, ctx);
      newStatus = "refunded";
      stampCol = "refunded_at";
    }

    if (!isOk(res)) {
      return NextResponse.json(
        apiError(`USENで取消に失敗しました (code=${res.code ?? "?"})`, "USEN_NG"),
        { status: 402 }
      );
    }

    await admin
      .from("payments")
      .update({ payment_status: newStatus, [stampCol]: new Date().toISOString() })
      .eq("id", payment.id);

    return NextResponse.json(apiOk({ id: payment.id, status: newStatus }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(apiError(`取消に失敗しました: ${msg}`, "USEN_ERROR"), { status: 502 });
  }
}
