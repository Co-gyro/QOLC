/**
 * GET/POST /api/payment/card/callback
 *
 * USEN PSP からのコールバック受信エンドポイント。
 * - /i/result で結果を取得し、成功なら member_id を resident_accounts に保存
 * - 同時に 1円与信を /auth/void で取消
 * - 完了後、ユーザーをカード管理画面にリダイレクト
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { tokenResult } from "@/lib/payment/token-api";
import { memberEntryByJutyuCd, authVoid } from "@/lib/payment/member-api";
import { apiError } from "@/types/api";

const callbackSchema = z.object({
  jutyu_cd: z.string().min(1).max(20),
  mall_cd: z.string().length(4).optional(),
});

async function handle(req: NextRequest) {
  // GETの場合はクエリ、POSTの場合はフォームから受信
  let params: Record<string, string> = {};
  if (req.method === "GET") {
    req.nextUrl.searchParams.forEach((v, k) => (params[k] = v));
  } else {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/x-www-form-urlencoded")) {
      const form = await req.formData();
      form.forEach((v, k) => (params[k] = String(v)));
    } else {
      try {
        params = (await req.json()) as Record<string, string>;
      } catch {
        // ignore
      }
    }
  }

  const parsed = callbackSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json(apiError("不正なコールバック", "BAD_CALLBACK"), {
      status: 400,
    });
  }

  // 認証セッションが残っていればユーザーID取得（監査ログ用）
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const performedBy = user?.id ?? null;
  const ip = req.headers.get("x-forwarded-for") ?? null;

  try {
    const result = await tokenResult(
      { jutyu_cd: parsed.data.jutyu_cd, mall_cd: parsed.data.mall_cd },
      { performedBy, ipAddress: ip }
    );

    if (!result.member_id) {
      return NextResponse.redirect(
        new URL(
          `/user/card?status=failed&reason=${encodeURIComponent(result.err_msg ?? "no_member_id")}`,
          req.url
        )
      );
    }

    const memberId = result.member_id;

    // 会員登録（取引経由）
    await memberEntryByJutyuCd(
      { member_id: memberId, jutyu_cd: parsed.data.jutyu_cd, mall_cd: parsed.data.mall_cd },
      { performedBy, ipAddress: ip }
    );

    // resident_accounts に member_id を保存
    const admin = getSupabaseAdminClient();
    // jutyu_cd から払い出した resident_account を一意に特定するため、
    // payments.usen_jutyu_cd の resident_account_id を経由する必要があるが、
    // カード登録時は Payment レコードを作らないため、jutyu_cd と resident_account の対応を
    // 別途持つ必要がある（将来的にテーブル追加検討）。
    // ここでは認証ユーザーから resident_accounts を取得し、最も新しい未登録のものに紐付ける暫定実装。
    if (user) {
      await admin
        .from("resident_accounts")
        .update({ usen_member_id: memberId })
        .eq("user_id", user.id)
        .eq("is_payment_owner", true)
        .is("deleted_at", null)
        .is("usen_member_id", null);
    }

    // 1円与信を取消
    await authVoid(
      { jutyu_cd: parsed.data.jutyu_cd, mall_cd: parsed.data.mall_cd },
      { performedBy, ipAddress: ip }
    );

    return NextResponse.redirect(new URL("/user/card?status=registered", req.url));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.redirect(
      new URL(`/user/card?status=failed&reason=${encodeURIComponent(msg)}`, req.url)
    );
  }
}

export const GET = handle;
export const POST = handle;
