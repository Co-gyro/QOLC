import { describe, expect, it } from "vitest";
import { type DeclarationRow, jstDate, jstDayRange, toDto } from "@/lib/wallet/declarations";
import { toLineRows, toReconcileLine } from "@/lib/wallet/statements";
import { bearerToken } from "@/lib/wallet/auth";

const row: DeclarationRow = {
  id: "d1", facility_id: "f1", resident_id: "r1", card_id: null, status: "matched", payment_method: "apple_pay",
  selected_at: "2026-10-13T05:00:00Z", paid_at: "2026-10-13T05:03:00Z", amount: 300, entered_amount: null,
  merchant_name: "まるやま", printed_at: null, residents: { name_last: "森", name_first: "はるこ" },
  receipt_images: [
    { storage_path: "old", ocr_items: [], ocr_payment_label: "PayPay", ocr_card_last4: null, deleted_at: "2026-10-13T06:00:00Z" },
    { storage_path: "new", ocr_items: [{ name: "お茶", amount: 300 }], ocr_payment_label: "QUICPay", ocr_card_last4: "7152", deleted_at: null },
  ],
};

describe("toDto", () => {
  it("iOS アプリの形にし、有効なレシートの読み取り結果を添える", () => {
    expect(toDto(row, "https://signed")).toMatchObject({
      resident_name: "森 はるこ", receipt_image_url: "https://signed",
      receipt_items: [{ name: "お茶", amount: 300 }], receipt_payment_label: "QUICPay", receipt_card_last4: "7152",
    });
  });
  it("レシートが無ければ null、明細が壊れていれば null", () => {
    expect(toDto({ ...row, receipt_images: [] })).toMatchObject({ receipt_items: null, receipt_payment_label: null });
    const broken = { ...row, receipt_images: [{ ...row.receipt_images![1], ocr_items: "x" }] };
    expect(toDto(broken).receipt_items).toBeNull();
  });
});

describe("日付", () => {
  it("日本時間の1日の範囲", () => {
    expect(jstDayRange("2026-10-13")).toEqual({ from: "2026-10-12T15:00:00.000Z", to: "2026-10-13T15:00:00.000Z" });
  });
  it("日本時間の日付", () => {
    expect(jstDate("2026-10-12T16:30:00Z")).toBe("2026-10-13");
  });
});

describe("明細行の変換", () => {
  it("下4桁からカードと施設を特定する（同じ下4桁が複数あれば特定しない）", () => {
    const cards = new Map([["7152", { cardId: "c1", facilityId: "f1" }], ["0000", null]]);
    const base = { targetMonth: "202610", usageDate: "2026-10-13", merchantName: "A", amount: 1, salesType: null,
      installmentCount: null, installmentNo: null, paymentAmount: 1, note: null, isReference: false };
    const rows = toLineRows("i1", [
      { ...base, lineNo: 2, cardLast4: "7152" }, { ...base, lineNo: 3, cardLast4: "0000" },
      { ...base, lineNo: 4, cardLast4: null, usageDate: null, isReference: true },
    ], cards);
    expect(rows.map((r) => [r.facility_id, r.match_status])).toEqual([["f1", "unmatched"], [null, "unmatched"], [null, "excluded"]]);
    expect(toReconcileLine({ id: "x", line_no: 2, card_id: "c1", facility_id: "f1", usage_date: "2026-10-13", merchant_name: "A", amount: 1, is_reference: false }))
      .toMatchObject({ cardId: "c1", amount: 1, isReference: false });
  });
});

describe("bearerToken", () => {
  it("Authorization ヘッダーから取り出す", () => {
    expect(bearerToken(new Request("http://x", { headers: { authorization: "Bearer abc" } }))).toBe("abc");
    expect(bearerToken(new Request("http://x"))).toBeNull();
  });
});
