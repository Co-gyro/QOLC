import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

import { detectJcbDataType, parseHeaderLine } from "@/lib/csv/jcb-rename";
import { buildCsvFilename } from "@/lib/csv/naming";

async function readJcbHeader(filename: string): Promise<string[]> {
  const buf = await readFile(`test-data/${filename}`);
  const decoded = new TextDecoder("shift-jis").decode(buf.subarray(0, 64 * 1024));
  const firstLine = decoded.split(/\r\n|\n|\r/)[0];
  return parseHeaderLine(firstLine);
}

describe("JCB CSV header detection", () => {
  it("detects UR (売上明細) from ダミー CSV", async () => {
    const cols = await readJcbHeader("JCB_売上明細CSV_ダミー.csv");
    const result = detectJcbDataType(cols);
    expect(result.dataType).toBe("UR");
  });

  it("detects FI (振込情報) from ダミー CSV", async () => {
    const cols = await readJcbHeader("JCB_振込情報CSV_ダミー.csv");
    const result = detectJcbDataType(cols);
    expect(result.dataType).toBe("FI");
  });

  it("detects FM (振込明細) from ダミー CSV", async () => {
    const cols = await readJcbHeader("JCB_振込明細CSV_ダミー.csv");
    const result = detectJcbDataType(cols);
    expect(result.dataType).toBe("FM");
  });

  it("returns null with reason for unknown headers", () => {
    const result = detectJcbDataType(["関係ない列A", "関係ない列B"]);
    expect(result.dataType).toBeNull();
    expect(result.reason).toMatch(/判別不可/);
  });
});

describe("JCB 命名規則 JCB_{種別}_{締日}_{支払先番号}.csv", () => {
  const cases = [
    { file: "JCB_売上明細CSV_ダミー.csv", expected: "JCB_UR_20260315_156742401.csv" },
    { file: "JCB_振込情報CSV_ダミー.csv", expected: "JCB_FI_20260315_156742401.csv" },
    { file: "JCB_振込明細CSV_ダミー.csv", expected: "JCB_FM_20260315_156742401.csv" },
  ];

  it.each(cases)(
    "$file → $expected (締日2026-03-15, 支払先156742401)",
    async ({ file, expected }) => {
      const cols = await readJcbHeader(file);
      const result = detectJcbDataType(cols);
      expect(result.dataType).not.toBeNull();
      const filename = buildCsvFilename({
        issuer: "JCB",
        dataType: result.dataType!,
        closingDate: "2026-03-15",
        payeeNumber: "156742401",
      });
      expect(filename).toBe(expected);
    },
  );
});
