import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { actionSchema } from "@/lib/udpay/action-schema";
import { matchRowsToCustomers } from "@/lib/udpay/csv-import";
import { todayJst } from "@/lib/udpay/logic";
import { getBillingMember } from "@/lib/udpay/prod/member";
import { loadBillingStore } from "@/lib/udpay/prod/snapshot";
import {
  copyLatestInvoices,
  createDraft,
  importLines,
  reserve,
  revertToDraft,
  updateLines,
  updateMail,
  type BillingCtx,
} from "@/lib/udpay/prod/invoices";
import { cancelConfirmation, confirmInvoices } from "@/lib/udpay/prod/confirm";
import { createBillingCustomer, importBillingCustomers, sendBillingRegistrationMail, updateBillingCustomer } from "@/lib/udpay/prod/billing-customers";
import { chargePayment } from "@/lib/udpay/prod/charge";
import { createChargeDeps } from "@/lib/udpay/prod/charge-deps";

/**
 * UD Payment（本番）の画面操作 API。画面部品はデモ（/api/udpay）と共通で、同じ action を受け付ける。
 * ログイン中の udpay_members（加盟店の担当者・承認者）だけが、自社のデータを操作できる。
 * 一括実行（決済確定）は承認者のみ。デモ専用の操作（カード模擬登録・模擬課金・初期化）は受け付けない。
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 操作結果を HTTP レスポンスにする（失敗は 400） */
function respond<T extends { ok: boolean }>(result: T): NextResponse {
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function POST(request: Request): Promise<NextResponse> {
  const member = await getBillingMember();
  if (!member) return NextResponse.json({ ok: false, error: "ご利用の権限がありません" }, { status: 403 });
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "入力が不正です" }, { status: 400 });
  }
  const ctx: BillingCtx = { client: getSupabaseAdminClient(), member, today: todayJst() };
  const input = parsed.data;
  try {
    switch (input.action) {
      case "createCustomer":
        return respond(await createBillingCustomer(ctx, input));
      case "updateCustomer":
        return respond(await updateBillingCustomer(ctx, input.customerId, input));
      case "importCustomers":
        return NextResponse.json({ ok: true, ...(await importBillingCustomers(ctx, input.customers, input.sendMail, new URL(request.url).origin)) });
      case "sendRegistrationMail":
        return respond(await sendBillingRegistrationMail(ctx, input.customerId, new URL(request.url).origin));
      case "copyPreviousMonth":
        return NextResponse.json({ ok: true, created: await copyLatestInvoices(ctx, input.month) });
      case "createInvoice":
        return respond(await createDraft(ctx, input.customerId, input.month));
      case "updateInvoiceLines":
        return respond(await updateLines(ctx, input.invoiceId, input.lines));
      case "updateInvoiceMail":
        return respond(await updateMail(ctx, input.invoiceId, input));
      case "reserveInvoices": {
        const r = await reserve(ctx, input.invoiceIds);
        const ok = r.reserved > 0 || r.errors.length === 0;
        return NextResponse.json({ ok, ...r, error: ok ? undefined : r.errors[0]?.error }, { status: ok ? 200 : 400 });
      }
      case "revertToDraft":
        return respond(await revertToDraft(ctx, input.invoiceId));
      case "confirmInvoices": {
        if (!member.isApprover) return NextResponse.json({ ok: false, error: "一括実行は承認者のみ行えます" }, { status: 403 });
        return NextResponse.json({ ok: true, ...(await confirmInvoices(ctx, input.invoiceIds)) });
      }
      case "cancelConfirmation":
        return respond(await cancelConfirmation(ctx, input.invoiceId));
      case "importInvoiceCsv": {
        const store = await loadBillingStore(ctx.client, member.merchantId);
        const { groups, unmatched } = matchRowsToCustomers(input.rows, store.customers);
        return NextResponse.json({ ok: true, ...(await importLines(ctx, input.month, groups)), unmatched });
      }
      case "retryPayment": {
        const { data: pay } = await ctx.client
          .from("udpay_payments")
          .select("id")
          .eq("id", input.paymentId)
          .eq("merchant_id", member.merchantId)
          .maybeSingle();
        if (!pay) return NextResponse.json({ ok: false, error: "決済が見つかりません" }, { status: 404 });
        const r = await chargePayment(createChargeDeps(member.userId), input.paymentId);
        if (r.outcome === "captured") return NextResponse.json({ ok: true });
        return NextResponse.json({ ok: false, error: r.error ?? "再決済できませんでした（与信落ちの決済のみ再決済できます）" }, { status: 400 });
      }
      default:
        return NextResponse.json({ ok: false, error: "この操作は本番では使えません" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "処理に失敗しました" }, { status: 500 });
  }
}
