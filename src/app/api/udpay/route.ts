import { NextResponse } from "next/server";
import { z } from "zod";
import {
  confirmInvoice,
  copyPreviousMonthInvoices,
  createCustomer,
  createInvoice,
  registerCardByToken,
  resetStore,
  retryPayment,
  runChargeBatch,
  updateInvoiceLines,
} from "@/lib/udpay/store";

/**
 * UD Payment（仮）デモの操作 API。
 * デモ専用のため認証なし・外部決済への接続なし。action で処理を振り分ける。
 */

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  description: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
  unitPrice: z.number().int().min(0).max(10_000_000),
  taxRate: z.number().int().min(0).max(10),
});

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("createCustomer"),
    name: z.string().min(1).max(100),
    contactName: z.string().min(1).max(50),
    email: z.string().email(),
    anniversaryDay: z.number().int().min(1).max(28),
  }),
  z.object({
    action: z.literal("registerCard"),
    token: z.string().min(1),
    cardNumber: z.string().min(14).max(23),
  }),
  z.object({
    action: z.literal("copyPreviousMonth"),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  z.object({
    action: z.literal("createInvoice"),
    customerId: z.string().min(1),
    month: z.string().regex(/^\d{4}-\d{2}$/),
  }),
  z.object({
    action: z.literal("updateInvoiceLines"),
    invoiceId: z.string().min(1),
    lines: z.array(lineSchema).max(30),
  }),
  z.object({ action: z.literal("confirmInvoice"), invoiceId: z.string().min(1) }),
  z.object({ action: z.literal("runChargeBatch") }),
  z.object({ action: z.literal("retryPayment"), paymentId: z.string().min(1) }),
  z.object({ action: z.literal("resetDemo") }),
]);

/** デモ操作を受け付ける（zod でバリデーションし、ストア操作へ委譲する） */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;
  switch (input.action) {
    case "createCustomer": {
      const customer = await createCustomer(input);
      return NextResponse.json({ ok: true, customer });
    }
    case "registerCard": {
      const result = await registerCardByToken(input.token, input.cardNumber);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "copyPreviousMonth": {
      const created = await copyPreviousMonthInvoices(input.month);
      return NextResponse.json({ ok: true, created });
    }
    case "createInvoice": {
      const invoice = await createInvoice(input.customerId, input.month);
      return NextResponse.json({ ok: true, invoice });
    }
    case "updateInvoiceLines": {
      const result = await updateInvoiceLines(input.invoiceId, input.lines);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "confirmInvoice": {
      const result = await confirmInvoice(input.invoiceId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "runChargeBatch": {
      const result = await runChargeBatch();
      return NextResponse.json({ ok: true, ...result });
    }
    case "retryPayment": {
      const result = await retryPayment(input.paymentId);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "resetDemo": {
      await resetStore();
      return NextResponse.json({ ok: true });
    }
  }
}
