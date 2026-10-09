/**
 * GET   /api/admin/udpay/customers/[id] — 顧客1件（編集画面用）
 * PATCH /api/admin/udpay/customers/[id] — 顧客の編集（UD管理者のみ。カード情報・登録リンクは変えない）
 */
import { NextResponse, type NextRequest } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { customerInputSchema, getCustomer, updateCustomer } from "@/lib/udpay/prod/customers";
import { getUdpayMerchant } from "@/lib/udpay/prod/merchants";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("顧客IDが不正です", "BAD_REQUEST"), { status: 400 });
  const customer = await getCustomer(getSupabaseAdminClient(), params.id);
  if (!customer) return NextResponse.json(apiError("顧客が見つかりません", "NOT_FOUND"), { status: 404 });
  return NextResponse.json(apiOk(customer));
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("顧客IDが不正です", "BAD_REQUEST"), { status: 400 });
  const parsed = customerInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "入力内容が不正です";
    return NextResponse.json(apiError(msg, "VALIDATION_ERROR"), { status: 400 });
  }
  const client = getSupabaseAdminClient();
  const current = await getCustomer(client, params.id);
  if (!current) return NextResponse.json(apiError("顧客が見つかりません", "NOT_FOUND"), { status: 404 });
  const merchant = await getUdpayMerchant(client, current.merchantId);
  if (merchant && !merchant.chargeDays.includes(parsed.data.chargeDay) && parsed.data.chargeDay !== current.chargeDay) {
    return NextResponse.json(apiError(`決済日は ${merchant.chargeDays.join("・")}日 から選んでください`, "VALIDATION_ERROR"), { status: 400 });
  }
  try {
    return NextResponse.json(apiOk(await updateCustomer(client, params.id, parsed.data)));
  } catch (e) {
    return NextResponse.json(apiError(e instanceof Error ? e.message : "更新に失敗しました"), { status: 500 });
  }
}
