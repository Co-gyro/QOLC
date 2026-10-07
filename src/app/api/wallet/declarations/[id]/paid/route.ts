/**
 * POST /api/wallet/declarations/:id/paid
 * 「支払い完了」を記録する（paid_at、status=awaiting_receipt）。
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { authorizeWalletStaff, walletError } from "@/lib/wallet/auth";
import { transitionDeclaration } from "@/lib/wallet/transition";

export const dynamic = "force-dynamic";

const schema = z.object({ payment_method: z.enum(["apple_pay", "physical_card"]) });

/** 支払い完了 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const staff = await authorizeWalletStaff(req);
  if ("response" in staff) return staff.response;
  const body = schema.safeParse(await req.json().catch(() => null));
  if (!body.success || !z.string().uuid().safeParse(params.id).success) {
    return walletError("入力が正しくありません", "VALIDATION", 400).response;
  }
  return transitionDeclaration(staff, {
    id: params.id,
    allowed: ["selecting"],
    patch: { status: "awaiting_receipt", paid_at: new Date().toISOString(), payment_method: body.data.payment_method },
    action: "wallet_declaration_paid",
    metadata: { payment_method: body.data.payment_method },
  });
}
