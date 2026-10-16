/**
 * POST /api/admin/udpay/payments/[id]/refund — 入金済みの決済を全額取消・返品する（UD管理者のみ）
 * 課金当日は売上取消＋与信取消（明細に載らない）、翌日以降は返品（明細に請求と返金が載る）。
 */
import { NextResponse } from "next/server";
import { isUuid, requireAdmin } from "@/lib/applications/server";
import { refundPayment } from "@/lib/udpay/prod/refund";
import { createRefundDeps } from "@/lib/udpay/prod/admin-payments";
import { apiError, apiOk } from "@/types/api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json(apiError(auth.message, auth.code), { status: auth.status });
  if (!isUuid(params.id)) return NextResponse.json(apiError("決済IDが不正です", "BAD_REQUEST"), { status: 400 });
  const result = await refundPayment(createRefundDeps(auth.user.id), params.id);
  if (!result.ok) return NextResponse.json(apiError(result.error, "REFUND_FAILED"), { status: 400 });
  return NextResponse.json(apiOk(result));
}
