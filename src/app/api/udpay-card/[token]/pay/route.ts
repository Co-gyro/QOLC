/**
 * POST /api/udpay-card/[token]/pay
 *
 * 3DS 認証後（SDK の OnPaymentStart）に呼ばれる。USEN /i/pay を実行し、成功なら会員IDと
 * カード情報（ブランド・下4桁・有効期限）を顧客に保存する。1円の与信のみで売上計上はしない。
 * 失敗時は入力し直せるよう新しい受注コードを返す。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { loadRegistrationContext, completeCardRegistration } from "@/lib/udpay/prod/card-registration";
import { createCardRegistrationDeps } from "@/lib/udpay/prod/deps";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  jutyu_cd: z.string().min(1).max(20),
  token: z.string().min(1),
  check_cd: z.string().min(1),
});

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(apiError("入力内容が不正です", "BAD_REQUEST"), { status: 400 });
  const deps = createCardRegistrationDeps(req.headers.get("x-forwarded-for"));
  const loaded = await loadRegistrationContext(deps.client, params.token);
  if (!loaded.ok) return NextResponse.json(apiError("登録リンクが無効です", "INVALID_LINK"), { status: 404 });
  try {
    const result = await completeCardRegistration(deps, loaded.ctx, parsed.data);
    return NextResponse.json(apiOk(result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return NextResponse.json(apiError(`カード登録に失敗しました: ${msg}`, "USEN_ERROR"), { status: 502 });
  }
}
