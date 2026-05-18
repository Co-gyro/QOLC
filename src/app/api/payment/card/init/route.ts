/**
 * POST /api/payment/card/init
 *
 * カード登録の初期化エンドポイント。
 * ログイン中の family ユーザー（payment owner）がカード登録を開始する際に呼び出す。
 *
 * フロー:
 *   1. 認証ユーザーから resident_account を解決
 *   2. is_payment_owner = true であること、まだ usen_member_id がないことを確認
 *   3. jutyu_cd を採番
 *   4. tokenInit でUSEN PSPに1円与信 + 3DS開始 → redirect_url を取得
 *   5. クライアントへ redirect_url を返す
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { tokenInit } from "@/lib/payment/token-api";
import { nextJutyuCd } from "@/lib/payment/member-api";
import { apiError, apiOk } from "@/types/api";

const requestSchema = z.object({
  residentAccountId: z.string().uuid(),
  /** USEN のコールバックURL（デフォルトはアプリ側で組み立て） */
  retUrl: z.string().url().optional(),
});

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

  const admin = getSupabaseAdminClient();
  const { data: account } = await admin
    .from("resident_accounts")
    .select("id, user_id, is_payment_owner, usen_member_id, resident_id")
    .eq("id", parsed.data.residentAccountId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!account || account.user_id !== user.id) {
    return NextResponse.json(apiError("対象アカウントが見つかりません", "NOT_FOUND"), {
      status: 404,
    });
  }
  if (!account.is_payment_owner) {
    return NextResponse.json(
      apiError("支払いオーナーのみがカード登録できます", "NOT_PAYMENT_OWNER"),
      { status: 403 }
    );
  }
  if (account.usen_member_id) {
    return NextResponse.json(
      apiError("既にカードが登録されています", "ALREADY_REGISTERED"),
      { status: 409 }
    );
  }

  // 入居者から施設→加盟店のmall_codeを解決（決済用モール）
  const { data: resident } = await admin
    .from("residents")
    .select("id, facility_id, facilities ( mall_code )")
    .eq("id", account.resident_id)
    .maybeSingle();
  const mallCode = (
    resident?.facilities as unknown as { mall_code: string | null } | null
  )?.mall_code;
  if (!mallCode) {
    return NextResponse.json(
      apiError("施設にモールコードが未割り当てです", "MALL_CODE_MISSING"),
      { status: 422 }
    );
  }

  const jutyu_cd = await nextJutyuCd(mallCode);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const retUrl =
    parsed.data.retUrl ?? `${baseUrl}/api/payment/card/callback`;

  try {
    const resp = await tokenInit(
      { jutyu_cd, retUrl, mall_cd: mallCode },
      {
        performedBy: user.id,
        ipAddress: req.headers.get("x-forwarded-for") ?? null,
      }
    );
    return NextResponse.json(
      apiOk({ redirectUrl: resp.redirect_url, jutyuCd: jutyu_cd })
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(apiError(`カード登録初期化失敗: ${msg}`, "USEN_ERROR"), {
      status: 502,
    });
  }
}
