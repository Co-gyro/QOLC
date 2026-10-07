import { describe, expect, it } from "vitest";
import type { DeclarationDto } from "@/lib/wallet/declarations";
import { monthRange, residentTotals, shiftMonth } from "@/lib/wallet/portal";

/** 記録を作る */
function d(id: string, residentId: string, status: string, amount: number | null, entered: number | null = null): DeclarationDto {
  return {
    id, resident_id: residentId, resident_name: residentId === "r1" ? "森 はるこ" : "川口 たけし", status, payment_method: "apple_pay",
    selected_at: "2026-10-13T05:00:00Z", paid_at: null, amount, entered_amount: entered, merchant_name: null,
    receipt_image_url: null, receipt_items: null, receipt_payment_label: null, receipt_card_last4: null,
  };
}

describe("月の範囲", () => {
  it("月末とうるう年", () => {
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("年をまたいでずらす", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("residentTotals", () => {
  it("入居者ごとに合計し、取消を除き、入力金額も数える", () => {
    const totals = residentTotals([
      d("1", "r1", "matched", 300), d("2", "r1", "awaiting_receipt", null, 500), d("3", "r1", "cancelled", 999),
      d("4", "r2", "reconciled", 129),
    ]);
    expect(totals).toEqual([
      { residentId: "r1", residentName: "森 はるこ", total: 800, count: 2, awaitingReceipt: 1 },
      { residentId: "r2", residentName: "川口 たけし", total: 129, count: 1, awaitingReceipt: 0 },
    ]);
  });
});
