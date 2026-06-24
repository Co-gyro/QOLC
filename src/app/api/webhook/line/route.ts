/**
 * POST /api/webhook/line
 *
 * LINE Messaging API の Webhook 受信口。
 * - X-Line-Signature を生のボディで検証（改ざん/なりすまし防止）
 * - follow（友だち追加）/ unfollow（ブロック）で resident_accounts.line_follow_state を更新
 *
 * 署名検証に失敗したら 403。LINE の検証リクエスト（空 events）にも 200 を返す。
 * 公開エンドポイント（middleware の PUBLIC_PATH に /api/webhook を含む）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { getLineMessagingConfig, isLineMessagingConfigured } from "@/lib/line/config";
import { verifyLineSignature } from "@/lib/line/signature";
import { extractFollowChanges } from "@/lib/line/webhook";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isLineMessagingConfigured()) {
    // 未設定でも LINE の到達性検証は通す（処理はしない）
    return NextResponse.json({ ok: true });
  }
  const { channelSecret } = getLineMessagingConfig();

  // 署名検証は「生のボディ」で行う必要があるため text() で取得
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature");
  if (!verifyLineSignature(rawBody, signature, channelSecret)) {
    return new NextResponse("invalid signature", { status: 403 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const changes = extractFollowChanges(body);
  if (changes.length === 0) return NextResponse.json({ ok: true });

  const admin = getSupabaseAdminClient();
  for (const change of changes) {
    // LINE userId → profile → resident_accounts を更新
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("line_user_id", change.lineUserId)
      .maybeSingle();
    if (!profile) continue;
    await admin
      .from("resident_accounts")
      .update({ line_follow_state: change.state })
      .eq("user_id", profile.id)
      .is("deleted_at", null);
  }

  return NextResponse.json({ ok: true });
}
