import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCustomer,
  loadStore,
  updateCustomer,
  markRegistrationMailSent,
  registerCardByToken,
  resetStore,
} from "@/lib/udpay/store";
import {
  cancelConfirmation,
  confirmInvoices,
  copyLatestInvoices,
  createInvoice,
  importInvoiceLines,
  reserveInvoices,
  revertToDraft,
  updateInvoiceLines,
  updateInvoiceMail,
} from "@/lib/udpay/invoice-actions";
import { retryPayment, runChargeBatch } from "@/lib/udpay/payment-actions";
import { matchRowsToCustomers } from "@/lib/udpay/csv-import";

/**
 * UD Payment（仮）デモの操作 API。
 * デモ専用のため認証なし・外部決済への接続なし。action で処理を振り分ける。
 */

export const dynamic = "force-dynamic";

const lineSchema = z.object({
  description: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
  unitPrice: z.number().int().min(-10_000_000).max(10_000_000),
  taxRate: z.number().int().min(0).max(10),
});

/** 顧客の入力項目（新規追加・編集で共通） */
const customerFields = {
  name: z.string().min(1).max(100),
  contactName: z.string().min(1).max(50),
  email: z.string().email(),
  cc: z.array(z.string().email()).max(10).optional(),
  anniversaryDay: z.number().int().min(1).max(28),
  note: z.string().max(500).optional(),
  postalCode: z.string().regex(/^\d{3}-?\d{4}$/).optional(),
  address1: z.string().max(100).optional(),
  address2: z.string().max(100).optional(),
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("createCustomer"), ...customerFields }),
  z.object({ action: z.literal("updateCustomer"), customerId: z.string().min(1), ...customerFields }),
  z.object({
    action: z.literal("registerCard"),
    token: z.string().min(1),
    cardNumber: z.string().min(14).max(23),
    expiry: z.string().max(7).optional(),
  }),
  z.object({ action: z.literal("sendRegistrationMail"), customerId: z.string().min(1) }),
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
  z.object({
    action: z.literal("updateInvoiceMail"),
    invoiceId: z.string().min(1),
    subject: z.string().max(200).optional(),
    comment: z.string().max(2000).optional(),
  }),
  z.object({ action: z.literal("reserveInvoices"), invoiceIds: z.array(z.string().min(1)).min(1).max(500) }),
  z.object({ action: z.literal("revertToDraft"), invoiceId: z.string().min(1) }),
  z.object({ action: z.literal("confirmInvoices"), invoiceIds: z.array(z.string().min(1)).min(1).max(500) }),
  z.object({ action: z.literal("cancelConfirmation"), invoiceId: z.string().min(1) }),
  z.object({
    action: z.literal("importInvoiceCsv"),
    month: z.string().regex(/^\d{4}-\d{2}$/),
    rows: z
      .array(
        z.object({
          line: z.number().int().min(1),
          name: z.string().max(100).optional(),
          email: z.string().max(200).optional(),
          description: z.string().min(1).max(100),
          quantity: z.number().int().min(1).max(99),
          unitPrice: z.number().int().min(-10_000_000).max(10_000_000),
        }),
      )
      .min(1)
      .max(500),
  }),
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
      const result = await registerCardByToken(input.token, input.cardNumber, input.expiry);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "updateCustomer":
      return respond(await updateCustomer(input.customerId, input));
    case "sendRegistrationMail":
      return respond(await markRegistrationMailSent(input.customerId));
    case "copyPreviousMonth": {
      const created = await copyLatestInvoices(input.month);
      return NextResponse.json({ ok: true, created });
    }
    case "createInvoice":
      return respond(await createInvoice(input.customerId, input.month));
    case "updateInvoiceLines": {
      const result = await updateInvoiceLines(input.invoiceId, input.lines);
      return NextResponse.json(result, { status: result.ok ? 200 : 400 });
    }
    case "updateInvoiceMail":
      return respond(await updateInvoiceMail(input.invoiceId, input));
    case "reserveInvoices": {
      const result = await reserveInvoices(input.invoiceIds);
      const ok = result.reserved > 0 || result.errors.length === 0;
      return NextResponse.json(
        { ok, ...result, error: ok ? undefined : result.errors[0]?.error },
        { status: ok ? 200 : 400 },
      );
    }
    case "revertToDraft":
      return respond(await revertToDraft(input.invoiceId));
    case "confirmInvoices": {
      const result = await confirmInvoices(input.invoiceIds);
      return NextResponse.json({ ok: true, ...result });
    }
    case "cancelConfirmation":
      return respond(await cancelConfirmation(input.invoiceId));
    case "importInvoiceCsv": {
      const store = await loadStore();
      const { groups, unmatched } = matchRowsToCustomers(input.rows, store.customers);
      const summary = await importInvoiceLines(input.month, groups);
      return NextResponse.json({ ok: true, ...summary, unmatched });
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

/** 操作結果を HTTP レスポンスにする（失敗は 400） */
function respond<T extends { ok: boolean }>(result: T): NextResponse {
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
