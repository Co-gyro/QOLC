import { afterAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  confirmInvoice,
  copyPreviousMonthInvoices,
  createCustomer,
  loadStore,
  registerCardByToken,
  resetStore,
  retryPayment,
  runChargeBatch,
  saveStore,
  updateInvoiceLines,
} from "@/lib/udpay/store";

// テスト用の一時ディレクトリへストアを隔離する（デモデータを壊さない・ファイルバックエンド固定）
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

describe("seed / loadStore", () => {
  it("シードには顧客6件・前月請求5件・入金済み決済5件が入っている", async () => {
    const store = await loadStore();
    expect(store.customers).toHaveLength(6);
    expect(store.invoices).toHaveLength(5);
    expect(store.payments).toHaveLength(5);
    expect(store.payments.every((p) => p.status === "paid")).toBe(true);
  });
});

describe("copyPreviousMonthInvoices", () => {
  it("前月分がある顧客の下書きを作成し、再実行しても重複しない", async () => {
    expect(await copyPreviousMonthInvoices("2026-07")).toBe(5);
    expect(await copyPreviousMonthInvoices("2026-07")).toBe(0);
    const store = await loadStore();
    const drafts = store.invoices.filter((i) => i.month === "2026-07");
    expect(drafts).toHaveLength(5);
    expect(drafts.every((d) => d.status === "draft")).toBe(true);
  });
});

describe("confirmInvoice", () => {
  it("確定でメール送付記録と課金スケジュールが作られる", async () => {
    await copyPreviousMonthInvoices("2026-07");
    const draft = (await loadStore()).invoices.find(
      (i) => i.month === "2026-07" && i.customerId === "cust-sakura",
    );
    expect(draft).toBeDefined();
    const result = await confirmInvoice(draft!.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // さくら歯科のアニバーサリー日は14日 → 翌月8/14に課金
    expect(result.payment.scheduledDate).toBe("2026-08-14");
    expect(result.payment.status).toBe("scheduled");
    const saved = (await loadStore()).invoices.find((i) => i.id === draft!.id);
    expect(saved?.status).toBe("confirmed");
    expect(saved?.mailSentAt).toBeTruthy();
  });

  it("カード未登録の顧客は確定できない", async () => {
    const inv = await createWakabaDraft();
    const result = await confirmInvoice(inv.id);
    expect(result.ok).toBe(false);
  });

  it("明細ゼロ件は確定できない", async () => {
    await copyPreviousMonthInvoices("2026-07");
    const draft = (await loadStore()).invoices.find(
      (i) => i.month === "2026-07" && i.customerId === "cust-sakura",
    );
    await updateInvoiceLines(draft!.id, []);
    expect((await confirmInvoice(draft!.id)).ok).toBe(false);
  });
});

describe("runChargeBatch / retryPayment", () => {
  it("demoFailOnce の顧客は一度だけ与信落ちし、再決済で入金済みになる", async () => {
    await copyPreviousMonthInvoices("2026-07");
    for (const inv of (await loadStore()).invoices.filter(
      (i) => i.month === "2026-07",
    )) {
      await confirmInvoice(inv.id);
    }
    const result = await runChargeBatch();
    expect(result.paid).toBe(4);
    expect(result.failed).toBe(1);
    const failed = (await loadStore()).payments.find((p) => p.status === "failed");
    expect(failed?.customerId).toBe("cust-minato");
    expect(failed?.attempts[0]?.reason).toBe("do_not_honor");

    const retried = await retryPayment(failed!.id);
    expect(retried.ok).toBe(true);
    const after = (await loadStore()).payments.find((p) => p.id === failed!.id);
    expect(after?.status).toBe("paid");
    expect(after?.attempts).toHaveLength(2);
  });
});

describe("createCustomer / registerCardByToken", () => {
  it("顧客追加とカード登録リンク経由の登録ができる", async () => {
    const customer = await createCustomer({
      name: "こだま歯科クリニック",
      contactName: "児玉",
      email: "demo-kodama@example.com",
      anniversaryDay: 15,
    });
    expect(customer.card.registered).toBe(false);
    const result = await registerCardByToken(
      customer.registrationToken,
      "4242 4242 4242 4242",
    );
    expect(result.ok).toBe(true);
    const saved = (await loadStore()).customers.find((c) => c.id === customer.id);
    expect(saved?.card.registered).toBe(true);
    expect(saved?.card.maskedNumber).toBe("**** **** **** 4242");
    expect(saved?.card.brand).toBe("Visa");
  });

  it("不正なトークン・不正なカード番号は拒否する", async () => {
    expect((await registerCardByToken("no-such-token", "4242424242424242")).ok).toBe(
      false,
    );
    expect((await registerCardByToken("demo-wakaba", "1111")).ok).toBe(false);
  });
});

/** わかば歯科（カード未登録）の当月下書きを作って返すヘルパー */
async function createWakabaDraft() {
  const store = await loadStore();
  const wakaba = store.customers.find((c) => c.id === "cust-wakaba")!;
  // わかば歯科は前月請求がないため新規作成が必要（copy では作られない）
  const inv = {
    id: "inv-wakaba-07",
    customerId: wakaba.id,
    month: "2026-07",
    lines: [
      { id: "l1", description: "基本サポート料金", quantity: 1, unitPrice: 9_900, taxRate: 10 },
    ],
    status: "draft" as const,
  };
  store.invoices.push(inv);
  await saveStore(store);
  return inv;
}
