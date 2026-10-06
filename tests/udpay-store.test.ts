import { afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addDays, chargeDateFor, currentMonth, previousMonth, todayJst } from "@/lib/udpay/logic";
import {
  createCustomer,
  loadStore,
  markRegistrationMailSent,
  parseCardExpiry,
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

// テスト用の一時ディレクトリへストアを隔離する（デモデータを壊さない・ファイルバックエンド固定）
const MONTH = currentMonth();
const TODAY = todayJst();
const TEST_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "udpay-store-test-"));
process.env.UDPAY_STORE_DIR = TEST_DIR;
delete process.env.UDPAY_STORE;

beforeEach(async () => {
  await resetStore();
});

afterAll(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  delete process.env.UDPAY_STORE_DIR;
});

/** 指定顧客の当月請求を返す */
async function currentInvoiceOf(customerId: string) {
  return (await loadStore()).invoices.find(
    (i) => i.month === MONTH && i.customerId === customerId,
  );
}

/** 当月分をコピーし、指定顧客の請求を課金予約まで進めて返す */
async function reservedInvoiceOf(customerId: string) {
  await copyLatestInvoices(MONTH);
  const inv = await currentInvoiceOf(customerId);
  await reserveInvoices([inv!.id]);
  return inv!;
}

describe("seed / loadStore", () => {
  it("顧客7件・前々月と前月の請求・決済が入っている", async () => {
    const store = await loadStore();
    expect(store.customers).toHaveLength(7);
    expect(store.invoices.filter((i) => i.month === previousMonth(MONTH))).toHaveLength(5);
    expect(store.payments).toHaveLength(store.invoices.length);
    // 決済日が今日以前の決済だけが入金済み
    for (const p of store.payments) {
      expect(p.status).toBe(p.scheduledDate <= TODAY ? "paid" : "scheduled");
    }
  });
});

describe("copyLatestInvoices", () => {
  it("各顧客の直近の請求からコピーし、再実行しても重複しない", async () => {
    // 前月分5件＋前々月にしか請求がないこだま歯科＝6件
    expect(await copyLatestInvoices(MONTH)).toBe(6);
    expect(await copyLatestInvoices(MONTH)).toBe(0);
    expect((await currentInvoiceOf("cust-kodama"))?.status).toBe("draft");
  });
});

describe("createInvoice", () => {
  it("同じ顧客・同じ月の請求は1件まで", async () => {
    expect((await createInvoice("cust-wakaba", MONTH)).ok).toBe(true);
    expect((await createInvoice("cust-wakaba", MONTH)).ok).toBe(false);
  });
});

describe("課金予約（要望4・7）", () => {
  it("課金予約してもメールは送らず、下書きに戻せる", async () => {
    const inv = await reservedInvoiceOf("cust-sakura");
    const reserved = await currentInvoiceOf("cust-sakura");
    expect(reserved?.status).toBe("reserved");
    expect(reserved?.mailSentAt).toBeUndefined();
    // 課金予約中は明細を編集できない
    expect((await updateInvoiceLines(inv.id, [])).ok).toBe(false);
    expect((await revertToDraft(inv.id)).ok).toBe(true);
    expect((await currentInvoiceOf("cust-sakura"))?.status).toBe("draft");
  });

  it("合計0円以下・明細なしは課金予約できない（マイナス明細は可）", async () => {
    await copyLatestInvoices(MONTH);
    const inv = await currentInvoiceOf("cust-sakura");
    await updateInvoiceLines(inv!.id, [
      { description: "基本", quantity: 1, unitPrice: 9_900, taxRate: 10 },
      { description: "値引き", quantity: 1, unitPrice: -9_900, taxRate: 10 },
    ]);
    const result = await reserveInvoices([inv!.id]);
    expect(result.reserved).toBe(0);
    expect(result.errors[0].error).toMatch(/0円以下/);
  });
});

describe("一括実行・決済確定（要望6）", () => {
  it("決済確定でメール送付記録と課金予定が作られる（決済日は顧客ごと）", async () => {
    const inv = await reservedInvoiceOf("cust-sakura");
    const result = await confirmInvoices([inv.id], `${MONTH}-01`);
    expect(result.confirmed).toBe(1);
    const saved = await currentInvoiceOf("cust-sakura");
    expect(saved?.status).toBe("confirmed");
    expect(saved?.mailSentAt).toBeTruthy();
    const payment = (await loadStore()).payments.find((p) => p.invoiceId === inv.id);
    // さくら歯科の決済日は14日 → 翌月14日に課金
    expect(payment?.scheduledDate).toBe(chargeDateFor(MONTH, 14));
  });

  it("決済日を過ぎてから決済確定した場合は翌日に課金する", async () => {
    const inv = await reservedInvoiceOf("cust-sakura");
    const late = addDays(chargeDateFor(MONTH, 14), 3);
    await confirmInvoices([inv.id], late);
    const payment = (await loadStore()).payments.find((p) => p.invoiceId === inv.id);
    expect(payment?.scheduledDate).toBe(addDays(late, 1));
  });

  it("カード未登録・カード期限切れ・下書きは対象外になる", async () => {
    await copyLatestInvoices(MONTH);
    await createInvoice("cust-wakaba", MONTH);
    const store = await loadStore();
    const ids = store.invoices.filter((i) => i.month === MONTH).map((i) => i.id);
    const wakaba = store.invoices.find((i) => i.month === MONTH && i.customerId === "cust-wakaba")!;
    await updateInvoiceLines(wakaba.id, [
      { description: "基本", quantity: 1, unitPrice: 9_900, taxRate: 10 },
    ]);
    const draftLeft = store.invoices.find((i) => i.month === MONTH && i.customerId === "cust-aoba")!;
    await reserveInvoices(ids.filter((id) => id !== draftLeft.id));
    const result = await confirmInvoices(ids, TODAY);
    const reasons = result.skipped.map((s) => s.reason).sort();
    expect(reasons).toEqual(["カード未登録", "カード期限切れ", "課金予約ではありません"].sort());
    expect(result.confirmed).toBe(4);
  });

  it("決済確定は課金日の前日まで取り消せ、課金予約に戻る", async () => {
    const inv = await reservedInvoiceOf("cust-sakura");
    await confirmInvoices([inv.id], `${MONTH}-01`);
    const chargeDate = chargeDateFor(MONTH, 14);
    expect((await cancelConfirmation(inv.id, chargeDate)).ok).toBe(false);
    expect((await cancelConfirmation(inv.id, addDays(chargeDate, -1))).ok).toBe(true);
    const saved = await currentInvoiceOf("cust-sakura");
    expect(saved?.status).toBe("reserved");
    expect(saved?.confirmationCancelledAt).toBeTruthy();
    expect((await loadStore()).payments.some((p) => p.invoiceId === inv.id)).toBe(false);
  });
});

describe("メールの編集（要望5）", () => {
  it("決済確定前は件名・追記コメントを保存でき、確定後は編集できない", async () => {
    const inv = await reservedInvoiceOf("cust-sakura");
    expect((await updateInvoiceMail(inv.id, { subject: "件名", comment: "追記" })).ok).toBe(true);
    expect((await currentInvoiceOf("cust-sakura"))?.mailComment).toBe("追記");
    await confirmInvoices([inv.id], `${MONTH}-01`);
    expect((await updateInvoiceMail(inv.id, { comment: "変更" })).ok).toBe(false);
  });
});

describe("runChargeBatch / retryPayment", () => {
  it("demoFailOnce の顧客は一度だけ与信落ちし、再決済で入金済みになる", async () => {
    const inv = await reservedInvoiceOf("cust-minato");
    await confirmInvoices([inv.id], `${MONTH}-01`);
    // 前月分にみなと歯科の課金待ちが残っている場合は、それが先に与信落ちする
    const result = await runChargeBatch();
    expect(result.failed).toBe(1);
    const failed = (await loadStore()).payments.find((p) => p.status === "failed");
    expect(failed?.customerId).toBe("cust-minato");
    expect(failed?.attempts[0]?.reason).toBe("do_not_honor");
    expect((await retryPayment(failed!.id)).ok).toBe(true);
    const after = (await loadStore()).payments.find((p) => p.id === failed!.id);
    expect(after?.status).toBe("paid");
    expect(after?.attempts).toHaveLength(2);
  });
});

describe("顧客・カード登録", () => {
  it("顧客追加（CC・備考つき）とカード登録リンク経由の登録ができる", async () => {
    const customer = await createCustomer({
      name: "なぎさ歯科クリニック",
      contactName: "渚",
      email: "demo-nagisa@example.com",
      cc: ["keiri@example.com"],
      anniversaryDay: 15,
      note: "テスト",
    });
    expect(customer.card.registered).toBe(false);
    const result = await registerCardByToken(customer.registrationToken, "4242 4242 4242 4242", "12/28");
    expect(result.ok).toBe(true);
    const saved = (await loadStore()).customers.find((c) => c.id === customer.id);
    expect(saved?.cc).toEqual(["keiri@example.com"]);
    expect(saved?.card.maskedNumber).toBe("**** **** **** 4242");
    expect(saved?.card.expireYm).toBe("202812");
    expect((await markRegistrationMailSent(customer.id)).ok).toBe(true);
  });

  it("不正なトークン・カード番号・有効期限は拒否する", async () => {
    expect((await registerCardByToken("no-such-token", "4242424242424242")).ok).toBe(false);
    expect((await registerCardByToken("demo-wakaba", "1111")).ok).toBe(false);
    expect((await registerCardByToken("demo-wakaba", "4242424242424242", "13/28")).ok).toBe(false);
  });

  it("有効期限の入力を YYYYMM にする", () => {
    expect(parseCardExpiry("3/29")).toBe("202903");
    expect(parseCardExpiry("12/2030")).toBe("203012");
    expect(parseCardExpiry("1229")).toBeNull();
  });
});

describe("importInvoiceLines（CSV一括取込）", () => {
  it("下書きは差し替え・未作成は新規・課金予約以降はスキップする", async () => {
    const sakura = await reservedInvoiceOf("cust-sakura");
    const line = (description: string, unitPrice: number) => ({
      description,
      quantity: 1,
      unitPrice,
      taxRate: 10,
    });
    const summary = await importInvoiceLines(MONTH, [
      { customerId: "cust-sakura", customerName: "さくら歯科クリニック", lines: [line("X", 100)] },
      { customerId: "cust-hikari", customerName: "ひかり歯科", lines: [line("労務管理サポート", 55_000)] },
      { customerId: "cust-wakaba", customerName: "わかば歯科", lines: [line("基本サポート料金", 9_900)] },
    ]);
    expect(summary.skippedConfirmed).toEqual(["さくら歯科クリニック"]);
    expect(summary.updated).toBe(1);
    expect(summary.created).toBe(1);
    const sakuraAfter = (await loadStore()).invoices.find((i) => i.id === sakura.id)!;
    expect(sakuraAfter.lines.some((l) => l.description === "X")).toBe(false);
  });
});
