/**
 * POST /api/wallet/declarations/:id/cancel
 * 記録を取り消す（支払い前、またはレシート待ちのもの）。
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeWalletStaff, walletError } from "@/lib/wallet/auth";
import { transitionDeclaration } from "@/lib/wallet/transition";

export const dynamic = "force-dynamic";

/** 取消 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;
  if (!z.string().uuid().safeParse(params.id).success) {
    return walletError("入力が正しくありません", "VALIDATION", 400).response;
  }
  return transitionDeclaration(staff, {
    id: params.id,
    allowed: ["selecting", "awaiting_receipt"],
    patch: { status: "cancelled" },
    action: "wallet_declaration_cancel",
  });
}
