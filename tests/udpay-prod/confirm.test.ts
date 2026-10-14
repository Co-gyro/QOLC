import { describe, expect, it, vi } from "vitest";
import { cancelConfirmation, confirmBlockReason, confirmInvoices } from "@/lib/udpay/prod/confirm";
import { toCustomerInput } from "@/lib/udpay/prod/billing-customers";
import type { BillingCtx } from "@/lib/udpay/prod/invoices";
import { fakeSupabase, type FakeTables } from "../helpers/fake-supabase";

const CUSTOMER = { usenMemberId: "Uabc", cardExpireYm: "203109" };

describe("confirmBlockReason（一括実行の可否）", () => {
  const ok = { status: "submitted", submittedBy: "staff", total: 11000 };
  it("課金予約・カード登録済み・合計あり・別の人なら実行できる", () => {
    expect(confirmBlockReason(ok, CUSTOMER, "approver", "2026-10-26")).toBeNull();
  });
  it("課金予約した本人は実行できない（職務分離）", () => {
    expect(confirmBlockReason(ok, CUSTOMER, "staff", "2026-10-26")).toMatch(/本人/);
  });
  it("カード未登録・期限切れ・下書きは対象外", () => {
    expect(confirmBlockReason(ok, { usenMemberId: null, cardExpireYm: null }, "a", "2026-10-26")).toBe("カード未登録");
    expect(confirmBlockReason(ok, { usenMemberId: "U", cardExpireYm: "202609" }, "a", "2026-10-26")).toBe("カード期限切れ");
    expect(confirmBlockReason({ ...ok, status: "draft" }, CUSTOMER, "a", "2026-10-26")).toBe("課金予約ではありません");
  });
});

/** 課金予約済みの請求1件（担当者 staff が予約・決済日28日） */
function tables(): FakeTables {
  return {
    udpay_invoices: [
      { id: "i1", merchant_id: "m1", customer_id: "c1", service_month: "2026-10", status: "submitted", submitted_by: "staff", total: 11000, deleted_at: null, mail_subject: null, mail_comment: "追記" },
    ],
    udpay_invoice_lines: [{ id: "l1", invoice_id: "i1", description: "基本料金", quantity: 1, unit_price: 10000, tax_rate: 10, deleted_at: null, sort: 0 }],
    udpay_customers: [
      { id: "c1", merchant_id: "m1", name: "さくら歯科", contact_name: "田中", charge_day: 28, registration_token: "t", usen_member_id: "Uabc", card_expire_ym: "203109", deleted_at: null },
    ],
    udpay_customer_contacts: [
      { customer_id: "c1", kind: "to", name: null, email: "to@example.com", deleted_at: null, sort: 0 },
      { customer_id: "c1", kind: "cc", name: null, email: "cc@example.com", deleted_at: null, sort: 1 },
    ],
    udpay_merchant_settings: [],
    udpay_payments: [],
    udpay_mail_logs: [],
  };
}

function ctx(t: FakeTables, userId = "approver", isApprover = true, today = "2026-10-26"): BillingCtx {
  return { client: fakeSupabase(t), member: { userId, merchantId: "m1", displayName: "永村", isApprover }, today };
}

describe("confirmInvoices / cancelConfirmation", () => {
  it("決済確定し、請求メールを To/CC へ送り、決済日28日の課金予定を作る", async () => {
    const t = tables();
    const send = vi.fn(async () => ({ sent: true, skipped: false, id: "re_1" }));
    const r = await confirmInvoices(ctx(t), ["i1"], send);
    expect(r).toMatchObject({ confirmed: 1, skipped: [], mailFailed: 0 });
    expect(t.udpay_invoices[0]).toMatchObject({ status: "approved", approved_by: "approver" });
    expect(t.udpay_payments[0]).toMatchObject({ invoice_id: "i1", amount: 11000, scheduled_date: "2026-11-28", status: "scheduled" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: ["to@example.com"], cc: ["cc@example.com"] }));
    const sent = (send.mock.calls[0] as unknown as [{ text: string }])[0].text;
    expect(sent).toContain("追記");
    expect(sent).toContain("2026年11月28日に自動決済");
    expect(t.udpay_mail_logs[0]).toMatchObject({ kind: "invoice", status: "sent" });
  });

  it("承認者でない・課金予約した本人は決済確定できない", async () => {
    const t = tables();
    const send = vi.fn();
    expect((await confirmInvoices(ctx(t, "x", false), ["i1"], send)).confirmed).toBe(0);
    expect((await confirmInvoices(ctx(t, "staff", true), ["i1"], send)).confirmed).toBe(0);
    expect(t.udpay_invoices[0].status).toBe("submitted");
    expect(send).not.toHaveBeenCalled();
  });

  it("課金日の前日までは取り消せ、課金予約に戻る（課金予定は cancelled）", async () => {
    const t = tables();
    await confirmInvoices(ctx(t), ["i1"], vi.fn(async () => ({ sent: true, skipped: false })));
    expect((await cancelConfirmation(ctx(t, "approver", true, "2026-11-28"), "i1")).ok).toBe(false);
    expect((await cancelConfirmation(ctx(t, "approver", true, "2026-11-27"), "i1")).ok).toBe(true);
    expect(t.udpay_invoices[0]).toMatchObject({ status: "submitted", approved_by: null });
    expect(t.udpay_payments[0].status).toBe("cancelled");
  });
});

describe("toCustomerInput", () => {
  it("画面の主宛先を To、CC をそれぞれ CC にする", () => {
    const r = toCustomerInput({ name: "A", contactName: "B", email: "a@x.jp", cc: ["c@x.jp"], anniversaryDay: 15, note: "メモ" });
    expect(r.contacts).toEqual([
      { kind: "to", email: "a@x.jp" },
      { kind: "cc", email: "c@x.jp" },
    ]);
    expect(r).toMatchObject({ chargeDay: 15, internalMemo: "メモ" });
  });
});
