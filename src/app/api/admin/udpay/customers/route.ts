/**
 * GET  /api/admin/udpay/customers?merchantId= — 加盟店の顧客一覧（UD管理者のみ）
 * POST /api/admin/udpay/customers             — 顧客の登録（カード登録リンクのトークンを発行）
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createCustomer, customerInputSchema, listCustomers } from "@/lib/udpay/prod/customers";
import { getUdpayMerchant } from "@/lib/udpay/prod/merchants";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  const merchantId = req.nextUrl.searchParams.get("merchantId") ?? "";
  if (!isUuid(merchantId)) return NextResponse.json(apiError("加盟店IDが不正です", "BAD_REQUEST"), { status: 400 });
  try {
    return NextResponse.json(apiOk(await listCustomers(getSupabaseAdminClient(), merchantId)));
  } catch (e) {
    return NextResponse.json(apiError(e instanceof Error ? e.message : "取得に失敗しました"), { status: 500 });
  }
}

const createSchema = customerInputSchema.and(z.object({ merchantId: z.string().uuid() }));

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "入力内容が不正です";
    return NextResponse.json(apiError(msg, "VALIDATION_ERROR"), { status: 400 });
  }
  const client = getSupabaseAdminClient();
  const merchant = await getUdpayMerchant(client, parsed.data.merchantId);
  if (!merchant) return NextResponse.json(apiError("UD Payment の加盟店ではありません", "NOT_FOUND"), { status: 404 });
  if (!merchant.chargeDays.includes(parsed.data.chargeDay)) {
    return NextResponse.json(apiError(`決済日は ${merchant.chargeDays.join("・")}日 から選んでください`, "VALIDATION_ERROR"), { status: 400 });
  }
  try {
    return NextResponse.json(apiOk(await createCustomer(client, merchant.id, parsed.data)), { status: 201 });
  } catch (e) {
    return NextResponse.json(apiError(e instanceof Error ? e.message : "登録に失敗しました"), { status: 500 });
  }
}
