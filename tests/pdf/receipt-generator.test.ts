import { describe, it, expect } from "vitest";
import { formatYen } from "../../src/lib/pdf/receipt-generator";

describe("formatYen", () => {
  it("3桁区切りで円表記（サンプル準拠・¥なし）", () => {
    expect(formatYen(0)).toBe("0円");
    expect(formatYen(1000)).toBe("1,000円");
    expect(formatYen(1234567)).toBe("1,234,567円");
  });

  it("小数は切り捨てる", () => {
    expect(formatYen(1234.99)).toBe("1,234円");
    expect(formatYen(0.5)).toBe("0円");
  });
});

describe("ReceiptDocument 構造", () => {
  it("ReactElement を返す（スモークテスト）", async () => {
    // pdf() の実行は重い & jsdom 不要なので、関数定義の存在確認のみ
    const mod = await import("../../src/lib/pdf/receipt-generator");
    expect(typeof mod.ReceiptDocument).toBe("function");
    expect(typeof mod.generateReceiptPdf).toBe("function");
    expect(typeof mod.uploadReceiptPdf).toBe("function");
  });
});
