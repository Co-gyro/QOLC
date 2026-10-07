import { describe, expect, it } from "vitest";
import { checkReceipt, type ReceiptCheckInput } from "@/lib/wallet/receipt-check";

const base: ReceiptCheckInput = {
  selectedAt: "2026-10-13T05:00:00Z",
  paidAt: "2026-10-13T05:03:00Z",
  enteredAmount: null,
  receiptAmount: 300,
  printedAt: "2026-10-13T05:02:00Z",
  receiptCardLast4: null,
  facilityCardLast4s: ["7152"],
};

describe("checkReceipt", () => {
  it("問題がなければ合格", () => {
    expect(checkReceipt(base)).toEqual({ ok: true, warnings: [] });
  });
  it("入力金額と合計の違い", () => {
    expect(checkReceipt({ ...base, enteredAmount: 320 }).warnings[0]).toContain("金額");
    expect(checkReceipt({ ...base, enteredAmount: 300 }).ok).toBe(true);
  });
  it("印字日時が支払いの時刻と離れている", () => {
    expect(checkReceipt({ ...base, printedAt: "2026-10-13T07:00:00Z" }).warnings[0]).toContain("日時");
    expect(checkReceipt({ ...base, printedAt: "2026-10-12T05:02:00Z" }).ok).toBe(false);
    expect(checkReceipt({ ...base, printedAt: null }).ok).toBe(true);
  });
  it("レシートのカード番号が施設のカードと違う", () => {
    expect(checkReceipt({ ...base, receiptCardLast4: "1821" }).warnings[0]).toContain("1821");
    expect(checkReceipt({ ...base, receiptCardLast4: "7152" }).ok).toBe(true);
    expect(checkReceipt({ ...base, receiptCardLast4: "1821", facilityCardLast4s: [] }).ok).toBe(true);
  });
});
