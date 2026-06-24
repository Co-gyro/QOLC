/**
 * POST /api/auth/line/liff
 *
 * LIFF（LINEアプリ内）からのログイン。
 * - body: { idToken }  … LIFF SDK の liff.getIDToken() が返す id_token
 * - id_token をローカル検証（HS256, nonce なし）し、line_user_id で既存ユーザーを特定
 * - 既存の連携済み家族のみログイン可（新規登録は招待リンク経由）
 * - magiclink で Supabase セッションを確立（Cookie 発行）→ クライアントは /user/home へ
 *
 * 非連携アカウントは 404 を返し、クライアントで「招待リンクから登録」を案内する。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getLineLoginConfig, isLiffConfigured } from "@/lib/line/config";
import { verifyLineIdToken } from "@/lib/line/verify";
import { findUserByLineId } from "@/lib/line/account";
import { establishSessionForEmail } from "@/lib/line/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ idToken: z.string().min(1) });

export async function POST(req: NextRequest) {
  if (!isLiffConfigured()) {
    return NextResponse.json(apiError("LIFFは利用できません", "LIFF_UNAVAILABLE"), { status: 503 });
  }
  const config = getLineLoginConfig();

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

  // id_token 検証（LIFF は nonce 往復がないため nonce 検証は省略。署名で正当性は担保）
  const now = Math.floor(Date.now() / 1000);
  let lineUserId: string;
  try {
    const claims = verifyLineIdToken(
      parsed.data.idToken,
      config.channelId,
      config.channelSecret,
      null,
      now
    );
    lineUserId = claims.sub;
  } catch (e) {
    // 一時診断: 失敗理由を特定するため、非機密クレーム(alg/iss/aud/exp)を返す。
    // ※ 原因特定後にこのブロックは通常のエラー応答へ戻す。
    let debug: Record<string, unknown> = { verifyError: (e as Error).message };
    try {
      const [h, p] = parsed.data.idToken.split(".");
      const header = JSON.parse(Buffer.from(h, "base64").toString("utf8"));
      const payload = JSON.parse(Buffer.from(p, "base64").toString("utf8"));
      debug = {
        verifyError: (e as Error).message,
        alg: header.alg,
        iss: payload.iss,
        aud: payload.aud,
        audExpected: config.channelId,
        audMatch: payload.aud === config.channelId,
        expValid: typeof payload.exp === "number" ? payload.exp >= now : null,
        hasNonce: Boolean(payload.nonce),
      };
    } catch {
      /* デコード自体に失敗 */
    }
    return NextResponse.json(
      { success: false, error: "LINE認証の検証に失敗しました", code: "VERIFY_FAILED", debug },
      { status: 401 }
    );
  }

  const admin = getSupabaseAdminClient();
  const existing = await findUserByLineId(admin, lineUserId);
  if (!existing) {
    return NextResponse.json(
      apiError("このLINEアカウントは未登録です。招待リンクからご登録ください。", "NOT_REGISTERED"),
      { status: 404 }
    );
  }

  try {
    const cookieClient = createSupabaseServerClient();
    await establishSessionForEmail(admin, cookieClient, existing.email);
  } catch {
    return NextResponse.json(apiError("ログイン処理に失敗しました", "SESSION_FAILED"), {
      status: 500,
    });
  }

  return NextResponse.json(apiOk({ redirectTo: "/user/home" }));
}
