/**
 * POST /api/wallet/declarations/:id/amount
 * 支払い後にスタッフが入力した金額（任意）を記録する。
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeWalletStaff, walletError } from "@/lib/wallet/auth";
import { transitionDeclaration } from "@/lib/wallet/transition";

export const dynamic = "force-dynamic";

const schema = z.object({ amount: z.number().int().min(1).max(1_000_000) });

/** 入力金額 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success || !z.string().uuid().safeParse(params.id).success) {
    return walletError("金額は1〜1,000,000円の整数で入力してください", "VALIDATION", 400).response;
  }
  return transitionDeclaration(staff, {
    id: params.id,
    allowed: ["awaiting_receipt"],
    patch: { entered_amount: body.data.amount },
    action: "wallet_declaration_amount",
    metadata: { amount: body.data.amount },
  });
}
