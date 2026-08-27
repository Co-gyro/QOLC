/**
 * payload 保護（src/lib/applications/payload-preserve.ts）のテスト。
 *
 * 管理画面の「申請内容の編集」は自分が持つ項目だけで payload を全置換するため、
 * フォームに項目の無い申請区分・規約同意の証跡が黙って消える事故を防ぐ。
 */
import { describe, it, expect } from "vitest";
import {
  PRESERVED_PAYLOAD_KEYS,
  mergePreservedPayload,
} from "../../src/lib/applications/payload-preserve";

const TERMS = {
  agreed: true,
  agreedAt: "2026-08-27T05:12:33.000Z",
  documents: [{ issuer: "jcb", title: "JCB加盟店規約", url: "https://example.test" }],
};

describe("mergePreservedPayload", () => {
  it("編集フォームが送らない申請区分・規約同意を引き継ぐ", () => {
    const prev = { corpName: "旧社名", applyType: "general", termsAgreement: TERMS };
    const next = { corpName: "新社名" }; // 編集フォームは自分の項目しか送らない
    const merged = mergePreservedPayload(prev, next);
    expect(merged.corpName).toBe("新社名");
    expect(merged.applyType).toBe("general");
    expect(merged.termsAgreement).toEqual(TERMS);
  });

  it("保護対象キーはフォーム側の値で上書きされない", () => {
    const prev = { applyType: "general", termsAgreement: TERMS };
    const next = { applyType: "care", termsAgreement: { agreed: false } };
    const merged = mergePreservedPayload(prev, next);
    expect(merged.applyType).toBe("general");
    expect(merged.termsAgreement).toEqual(TERMS);
  });

  it("編集対象の項目は空欄クリア（キー省略）の挙動を保つ", () => {
    const prev = { corpName: "旧社名", note: "消したいメモ", applyType: "care" };
    const next = { corpName: "新社名" };
    const merged = mergePreservedPayload(prev, next);
    expect(merged.note).toBeUndefined();
  });

  it("元の payload に保護対象が無ければ生やさない", () => {
    const merged = mergePreservedPayload({ corpName: "社名" }, { corpName: "社名2" });
    expect("applyType" in merged).toBe(false);
    expect("termsAgreement" in merged).toBe(false);
  });

  it("prev が null / undefined でも壊れない", () => {
    expect(mergePreservedPayload(null, { corpName: "社名" })).toEqual({ corpName: "社名" });
    expect(mergePreservedPayload(undefined, {})).toEqual({});
  });

  it("保護対象キーの定義", () => {
    expect([...PRESERVED_PAYLOAD_KEYS]).toEqual(["applyType", "termsAgreement"]);
  });
});
