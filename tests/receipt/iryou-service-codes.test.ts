/**
 * 訪問看護療養費コード名称解決のテスト
 */
import { describe, it, expect } from "vitest";
import { resolveIryouServiceName } from "../../src/lib/receipt/iryou-service-codes";

describe("resolveIryouServiceName", () => {
  it("マスタにあるコードは漢字名称を返す", () => {
    // iryou-service-codes.json（訪問看護療養費マスター取込）より
    expect(resolveIryouServiceName("510001010")).toContain("訪問看護基本療養費");
    expect(resolveIryouServiceName("550000410")).toContain("訪問看護管理療養費");
  });
  it("マスタに無いコードはコードをそのまま返す", () => {
    expect(resolveIryouServiceName("999999999")).toBe("999999999");
  });
  it("前後空白は除去して解決", () => {
    expect(resolveIryouServiceName(" 510001010 ")).toContain("訪問看護基本療養費");
  });
});
