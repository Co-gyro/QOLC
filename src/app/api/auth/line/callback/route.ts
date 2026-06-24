/**
 * GET /api/auth/line/callback
 *
 * LINE Login のコールバック。
 * 1. state の二重送信（Cookie 一致）と署名・期限を検証（CSRF/リプレイ対策）
 * 2. 認可コードをトークン交換し、id_token をローカル検証（HS256）
 * 3. line_user_id で既存ユーザーを検索。なければ招待トークン経由でのみ新規作成
 * 4. magiclink で Supabase セッションを確立（Cookie 発行）
 * 5. next（内部パス）または /user/home へリダイレクト
 *
 * 失敗時は理由コード付きで /login にリダイレクトする（詳細はサーバーログのみ）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import {
  getLineLoginConfig,
  isLineLoginConfigured,
  LINE_STATE_COOKIE,
  LINE_STATE_TTL_SEC,
} from "@/lib/line/config";
import { exchangeCodeForToken } from "@/lib/line/oauth";
import { verifyState } from "@/lib/line/state";
import { verifyLineIdToken } from "@/lib/line/verify";
import { findUserByLineId } from "@/lib/line/account";
import { acceptInviteWithLine, LineInviteError } from "@/lib/line/invite";
import { establishSessionForEmail } from "@/lib/line/session";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/audit/activity-log";

export const dynamic = "force-dynamic";

/** /login?error=... へリダイレクトしつつ state Cookie を消す */
function fail(req: NextRequest, code: string): NextResponse {
  const res = NextResponse.redirect(new URL(`/login?error=${code}`, req.url));
  res.cookies.delete(LINE_STATE_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  if (!isLineLoginConfigured()) return fail(req, "line_unavailable");
  const config = getLineLoginConfig();

  const url = new URL(req.url);
  // ユーザーが LINE 同意をキャンセルした場合など
  if (url.searchParams.get("error")) return fail(req, "line_cancelled");

  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const cookieState = req.cookies.get(LINE_STATE_COOKIE)?.value;

  // 二重送信チェック（CSRF）: クエリの state と Cookie の state が完全一致すること
  if (!code || !stateParam || !cookieState || stateParam !== cookieState) {
    return fail(req, "line_state");
  }

  const now = Math.floor(Date.now() / 1000);
  let payload;
  try {
    payload = verifyState(stateParam, config.channelSecret, LINE_STATE_TTL_SEC, now);
  } catch {
    return fail(req, "line_state");
  }

  // トークン交換 + id_token 検証
  let lineUserId: string;
  let displayName: string | undefined;
  try {
    const token = await exchangeCodeForToken(config, code);
    if (!token.id_token) return fail(req, "line_token");
    const claims = verifyLineIdToken(
      token.id_token,
      config.channelId,
      config.channelSecret,
      payload.nonce,
      now
    );
    lineUserId = claims.sub;
    displayName = claims.name;
  } catch {
    return fail(req, "line_verify");
  }

  const admin = getSupabaseAdminClient();

  // get-or-create
  let account: { userId: string; email: string };
  let newlyRegistered = false;
  let registeredFacilityId: string | null = null;
  let registeredResidentId: string | null = null;
  try {
    const existing = await findUserByLineId(admin, lineUserId);
    if (existing) {
      account = existing;
    } else if (payload.inviteToken) {
      const result = await acceptInviteWithLine(admin, payload.inviteToken, {
        iss: "https://access.line.me",
        sub: lineUserId,
        aud: config.channelId,
        exp: 0,
        iat: 0,
        name: displayName,
      });
      account = { userId: result.userId, email: result.email };
      newlyRegistered = true;
      registeredFacilityId = result.facilityId;
      registeredResidentId = result.residentId;
    } else {
      // 既存リンクなし & 招待なし → 家族アカウントは招待制のため登録不可
      return fail(req, "line_unregistered");
    }
  } catch (e) {
    if (e instanceof LineInviteError) {
      const map: Record<string, string> = {
        NOT_FOUND: "invite_notfound",
        USED: "invite_used",
        EXPIRED: "invite_expired",
        OWNER_EXISTS: "invite_owner",
        LINK_FAILED: "line_link",
      };
      return fail(req, map[e.code] ?? "line_link");
    }
    return fail(req, "line_link");
  }

  // セッション確立（Cookie 発行）
  try {
    const cookieClient = createSupabaseServerClient();
    await establishSessionForEmail(admin, cookieClient, account.email);
  } catch {
    return fail(req, "line_session");
  }

  if (newlyRegistered) {
    await logActivity({
      actorId: account.userId,
      actorName: displayName || "LINEユーザー",
      actorRole: "family",
      action: "invite_accept_line",
      facilityId: registeredFacilityId,
      targetType: "account",
      targetId: registeredResidentId,
      targetLabel: displayName || "LINEユーザー",
    });
  }

  // 成功: state Cookie を破棄して遷移
  const cookieStore = cookies();
  cookieStore.delete(LINE_STATE_COOKIE);
  return NextResponse.redirect(new URL(payload.next ?? "/user/home", req.url));
}
