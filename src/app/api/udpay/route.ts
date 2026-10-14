import { NextResponse } from "next/server";
import { actionSchema } from "@/lib/udpay/action-schema";
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
