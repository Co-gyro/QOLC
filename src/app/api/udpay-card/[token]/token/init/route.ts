/**
 * POST /api/udpay-card/[token]/token/init
 *
 * UD Payment のカード登録ページ（/pay/udpay/[token]）の USEN SDK から呼ばれる。
 * 登録リンクのトークンで顧客を特定し、会員ID・3DS用メールを補って USEN /i/token/init を呼ぶ。
 * レスポンスは SDK へそのまま返す（3DS 認証が始まる）。ログイン不要（リンクを持つ顧客本人が操作）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadRegistrationContext, initCardToken } from "@/lib/udpay/prod/card-registration";
import { createCardRegistrationDeps } from "@/lib/udpay/prod/deps";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  jutyu_cd: z.string().min(1).max(20),
  token: z.string().min(1),
  card_limit_yyyy: z.string().regex(/^\d{4}$/),
  card_limit_mm: z.string().regex(/^\d{2}$/),
  cardholder_name: z.string().min(1).max(45),
  pay_method: z.string().optional().nullable(),
});

/** SDK が解釈できる形の失敗レスポンス（result=ng） */
function ng(message: string, status: number) {
  return NextResponse.json({ result: "ng", code: "UD", message }, { status });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return ng("入力内容が不正です", 400);
  const deps = createCardRegistrationDeps(req.headers.get("x-forwarded-for"));
  const loaded = await loadRegistrationContext(deps.client, params.token);
  if (!loaded.ok) return ng("登録リンクが無効です", 404);
  try {
    const result = await initCardToken(deps, loaded.ctx, parsed.data);
    if (!result.ok) return ng(result.error, 422);
    return NextResponse.json(result.response);
  } catch (e) {
    return ng(`カード登録の準備に失敗しました: ${e instanceof Error ? e.message : "unknown"}`, 502);
  }
}
