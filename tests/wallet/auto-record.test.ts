import { describe, expect, it } from "vitest";
import { generateDeviceKey, hashDeviceKey, linkAutoRecord, normalizeAutoRecord, parseAutoAmount } from "@/lib/wallet/auto-record";

describe("parseAutoAmount", () => {
  it("さまざまな金額の表記を読む", () => {
    expect(parseAutoAmount("¥1,234")).toBe(1234);
    expect(parseAutoAmount("1,234円")).toBe(1234);
    expect(parseAutoAmount("JP¥ 319")).toBe(319);
    expect(parseAutoAmount("￥１２９")).toBe(129);
    expect(parseAutoAmount("1234.00")).toBe(1234);
  });
  it("読めない・外貨の小数・空は null", () => {
    expect(parseAutoAmount("")).toBeNull();
    expect(parseAutoAmount(undefined)).toBeNull();
    expect(parseAutoAmount("$12.50")).toBeNull();
    expect(parseAutoAmount("金額なし")).toBeNull();
  });
});

describe("normalizeAutoRecord", () => {
  it("空白を除き、金額は文字列も残す", () => {
    expect(normalizeAutoRecord({ merchant: " ﾌｧﾐﾘｰﾏｰﾄ ", amount: "¥319", card: "JCB", name: "" })).toEqual({
      merchant_name: "ファミリーマート", amount: 319, amount_text: "¥319", card_name: "JCB", transaction_name: null,
    });
  });
});

describe("端末の鍵", () => {
  it("紛らわしい文字を含まず、ハッシュは同じ鍵で同じ値", () => {
    const key = generateDeviceKey();
    expect(key).toHaveLength(32);
    expect(key).not.toMatch(/[Il1O0o]/);
    expect(hashDeviceKey(key)).toBe(hashDeviceKey(key));
    expect(hashDeviceKey(key)).not.toBe(hashDeviceKey(key + "x"));
  });
});

describe("linkAutoRecord", () => {
  const at = (min: number) => new Date(Date.UTC(2026, 9, 13, 5, min)).toISOString();
  it("支払い完了の時刻に近い記録に結びつける", () => {
    const id = linkAutoRecord(at(12), [
      { id: "a", status: "awaiting_receipt", selectedAt: at(0), paidAt: at(2) },
      { id: "b", status: "awaiting_receipt", selectedAt: at(9), paidAt: at(11) },
    ]);
    expect(id).toBe("b");
  });
  it("支払い完了を押す前（選択中）の記録にも結びつける（押し忘れを補う）", () => {
    expect(linkAutoRecord(at(5), [{ id: "a", status: "selecting", selectedAt: at(3), paidAt: null }])).toBe("a");
  });
  it("記録がない・離れている・取消のときは null（記録のない支払い）", () => {
    expect(linkAutoRecord(at(5), [])).toBeNull();
    expect(linkAutoRecord(at(40), [{ id: "a", status: "awaiting_receipt", selectedAt: at(0), paidAt: at(2) }])).toBeNull();
    expect(linkAutoRecord(at(5), [{ id: "a", status: "cancelled", selectedAt: at(3), paidAt: null }])).toBeNull();
    expect(linkAutoRecord(at(0), [{ id: "a", status: "selecting", selectedAt: at(10), paidAt: null }])).toBeNull();
  });
});
