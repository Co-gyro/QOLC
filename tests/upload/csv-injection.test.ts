import { describe, it, expect } from "vitest";
import {
  sanitizeCell,
  sanitizeRow,
} from "../../src/lib/upload/csv-injection";

describe("sanitizeCell", () => {
  it("空文字はそのまま", () => {
    expect(sanitizeCell("")).toBe("");
  });
  it("安全な文字はそのまま", () => {
    expect(sanitizeCell("田中太郎")).toBe("田中太郎");
    expect(sanitizeCell("1000")).toBe("1000");
    expect(sanitizeCell("abc")).toBe("abc");
  });
  it("= で始まる値は ' を先頭につける", () => {
    expect(sanitizeCell("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
  });
  it("+ - @ で始まる値も無害化", () => {
    expect(sanitizeCell("+1+2")).toBe("'+1+2");
    expect(sanitizeCell("-CMD")).toBe("'-CMD");
    expect(sanitizeCell("@SUM(1+1)")).toBe("'@SUM(1+1)");
  });
  it("タブ・キャリッジリターンで始まる値も無害化", () => {
    expect(sanitizeCell("\t=DANGER")).toBe("'\t=DANGER");
    expect(sanitizeCell("\rEVIL")).toBe("'\rEVIL");
  });
  it("途中に等号があるのは無害化しない", () => {
    expect(sanitizeCell("a=1")).toBe("a=1");
  });
});

describe("sanitizeRow", () => {
  it("文字列フィールドのみ無害化", () => {
    const row = {
      name: "田中太郎",
      formula: "=A1",
      amount: 1000,
      flag: true,
    };
    const result = sanitizeRow(row);
    expect(result.name).toBe("田中太郎");
    expect(result.formula).toBe("'=A1");
    expect(result.amount).toBe(1000);
    expect(result.flag).toBe(true);
  });
});
