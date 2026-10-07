/**
 * GET /api/wallet/statements/:id/review
 * 突合の結果（照合済み・要確認・対象外）と、明細に現れていない記録の一覧（運営センター）。
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authorizeWalletAdmin, walletError } from "@/lib/wallet/auth";
import { loadStatementReview } from "@/lib/wallet/review";
import { apiOk } from "@/types/api";

export const dynamic = "force-dynamic";

/** 突合の結果 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeWalletAdmin(req);
  if ("response" in auth) return auth.response;
  if (!z.string().uuid().safeParse(params.id).success) return walletError("入力が正しくありません", "VALIDATION", 400).response;
  const review = await loadStatementReview(auth.admin, params.id);
  if (!review) return walletError("明細が見つかりません", "NOT_FOUND", 404).response;
  return NextResponse.json(apiOk(review));
}
