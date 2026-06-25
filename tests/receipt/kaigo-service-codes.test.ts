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
  it("マスタにある項目はサービス内容略称を返す", () => {
    // kaigo-service-codes.json（マスタ取込）より
    expect(resolveServiceName("11", "1211")).toBe("身体介護２");
    expect(resolveServiceName("15", "2241")).toBe("通所介護Ⅰ１１");
  });
  it("マスタに無い項目は「種類名（項目コード）」", () => {
    expect(resolveServiceName("15", "9999")).toBe("通所介護（9999）");
  });
  it("項目コードが空なら種類名のみ", () => {
    expect(resolveServiceName("13", "")).toBe("訪問看護");
  });
});
