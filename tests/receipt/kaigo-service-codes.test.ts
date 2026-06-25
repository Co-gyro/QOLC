/**
 * 介護サービスコード名称解決のテスト
 */
import { describe, it, expect } from "vitest";
import {
  resolveServiceTypeName,
  resolveServiceName,
} from "../../src/lib/receipt/kaigo-service-codes";

describe("resolveServiceTypeName", () => {
  it("既知の種類コードは名称を返す", () => {
    expect(resolveServiceTypeName("11")).toBe("訪問介護");
    expect(resolveServiceTypeName("13")).toBe("訪問看護");
    expect(resolveServiceTypeName("15")).toBe("通所介護");
  });
  it("未知の種類コードはフォールバック", () => {
    expect(resolveServiceTypeName("99")).toBe("サービス種類99");
    expect(resolveServiceTypeName("")).toBe("サービス種類?");
  });
});

describe("resolveServiceName", () => {
  it("項目名未取り込みは「種類名（項目コード）」で返す", () => {
    expect(resolveServiceName("15", "2241")).toBe("通所介護（2241）");
  });
  it("項目コードが空なら種類名のみ", () => {
    expect(resolveServiceName("13", "")).toBe("訪問看護");
  });
});
