import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

import {
  detectSaisonUr,
  parseHeaderLine,
} from "@/lib/csv/saison-rename";
import { buildCsvFilename } from "@/lib/csv/naming";

async function readSaisonHeader(filename: string): Promise<string[]> {
  const buf = await readFile(`test-data/${filename}`);
  const decoded = new TextDecoder("shift-jis").decode(buf.subarray(0, 64 * 1024));
  const firstLine = decoded.split(/\r\n|\n|\r/)[0];
  return parseHeaderLine(firstLine);
}

describe("Saison UR header detection", () => {
  it("detects Saison UR from ダミー CSV", async () => {
    const cols = await readSaisonHeader("セゾン_売上データCSV_ダミー.csv");
    const result = detectSaisonUr(cols);
    expect(result.isSaisonUr).toBe(true);
    expect(result.reason).toMatch(/セゾン売上明細/);
  });

  it("rejects CSVs lacking required columns", () => {
    const result = detectSaisonUr(["データ作成年月日", "加盟店名"]);
    expect(result.isSaisonUr).toBe(false);
    expect(result.reason).toMatch(/未検出列/);
  });
});

describe("Saison UR 命名規則 SAISON_UR_{締日}_{支払先番号}.csv", () => {
  it("ダミーCSV → SAISON_UR_20260315_156742401.csv", async () => {
    const cols = await readSaisonHeader("セゾン_売上データCSV_ダミー.csv");
    expect(detectSaisonUr(cols).isSaisonUr).toBe(true);
    const filename = buildCsvFilename({
      issuer: "SAISON",
      dataType: "UR",
      closingDate: "2026-03-15",
      payeeNumber: "156742401",
    });
    expect(filename).toBe("SAISON_UR_20260315_156742401.csv");
  });
});
