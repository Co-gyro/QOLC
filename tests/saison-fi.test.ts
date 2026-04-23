import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

import { parseSaisonCsv } from "@/lib/csv/saison-fm";
import { parseSaisonPdfText } from "@/lib/pdf/saison-pdf-text";
import { crossPdfCsvToFi, renderFiCsv } from "@/lib/csv/saison-fi";

import { extractPdfTextInNode } from "./helpers/pdf-node";

async function loadCsvRows() {
  const buf = await readFile("test-data/セゾン_売上データCSV_ダミー.csv");
  return parseSaisonCsv(new TextDecoder("shift-jis").decode(buf));
}

async function loadPdfData(filename: string) {
  const text = await extractPdfTextInNode(`test-data/${filename}`);
  return parseSaisonPdfText(text);
}

describe("parseSaisonPdfText (PDF読取)", () => {
  it("0315締め 施設A PDF: 全項目が読める", async () => {
    const data = await loadPdfData("セゾン_支払計算書PDF_0315締め_ダミー.pdf");
    expect(data.merchantNo).toBe("1234567");
    expect(data.merchantStoreNo).toBe("000001");
    expect(data.merchantName).toBe("テスト介護施設A");
    expect(data.closingDate).toBe("2026/03/15");
    expect(data.transferDate).toBe("2026/03/31");
    expect(data.totalAmount).toBe(130000);
    expect(data.totalFee).toBe(4225);
    expect(data.totalTransfer).toBe(125775);
  });

  it("0331締め 施設A PDF: 振込日は 4/15、売上 220,000", async () => {
    const data = await loadPdfData("セゾン_支払計算書PDF_0331締め_ダミー.pdf");
    expect(data.transferDate).toBe("2026/04/15");
    expect(data.totalAmount).toBe(220000);
    expect(data.totalFee).toBe(7150);
    expect(data.totalTransfer).toBe(212850);
  });

  it("0315締め 施設B PDF: 加盟店店舗No=000002、手数料3,348", async () => {
    const data = await loadPdfData("セゾン_支払計算書PDF_0315締め_施設B_ダミー.pdf");
    expect(data.merchantStoreNo).toBe("000002");
    expect(data.merchantName).toBe("テスト介護施設B");
    expect(data.totalAmount).toBe(103000);
    expect(data.totalFee).toBe(3348);
    expect(data.totalTransfer).toBe(99652);
  });
});

describe("crossPdfCsvToFi (PDF × CSV クロス集計)", () => {
  it("0315締め 施設A: README期待値と一致", async () => {
    const rows = await loadCsvRows();
    const pdf = await loadPdfData("セゾン_支払計算書PDF_0315締め_ダミー.pdf");

    const files = crossPdfCsvToFi([pdf], rows, { payeeNumber: "156742401" });
    expect(files.length).toBe(1);
    const f = files[0];

    expect(f.totals.売上金額).toBe(130000);
    expect(f.totals.手数料).toBe(4225);
    expect(f.totals.振込金額).toBe(125775);
    expect(f.rateDisplay).toBe(3.25);

    expect(f.feeDifference).toBe(0);
    expect(f.transferDifference).toBe(0);

    const payments = f.rows.map((r) => r.支払区分).sort();
    expect(payments).toEqual(["1回払い", "2回払い"]);
  });

  it("0315締め 施設B: 1円差異ゼロ (Math.round端数処理)", async () => {
    const rows = await loadCsvRows();
    const pdf = await loadPdfData("セゾン_支払計算書PDF_0315締め_施設B_ダミー.pdf");

    const files = crossPdfCsvToFi([pdf], rows, { payeeNumber: "156742401" });
    const f = files[0];

    // 103,000 × 3.25% = 3347.5 → Math.round=3348 (セゾン実挙動と一致)
    expect(f.totals.手数料).toBe(3348);
    expect(f.totals.振込金額).toBe(99652);
    expect(f.feeDifference).toBe(0);
    expect(f.transferDifference).toBe(0);

    // 支払区分別: 1回払い (25000+33000=58000) と リボ払い (45000)
    const payments = Object.fromEntries(f.rows.map((r) => [r.支払区分, r]));
    expect(payments["1回払い"].売上金額).toBe(58000);
    expect(payments["リボ払い"].売上金額).toBe(45000);
    // 1回払い: 58000 × 3.25048% ≈ 1885.28 → 1885
    // リボ払い: 45000 × 3.25048% ≈ 1462.72 → 1463
    expect(payments["1回払い"].手数料).toBe(1885);
    expect(payments["リボ払い"].手数料).toBe(1463);
    // 手数料合計 = 1885 + 1463 = 3348 = PDF値 (1円ズレなし)
  });
});

describe("renderFiCsv (FIフォーマット出力)", () => {
  it("CRLF + 10カラムで出力される", async () => {
    const rows = await loadCsvRows();
    const pdf = await loadPdfData("セゾン_支払計算書PDF_0315締め_ダミー.pdf");
    const files = crossPdfCsvToFi([pdf], rows, { payeeNumber: "156742401" });
    const csv = renderFiCsv(files[0]);
    expect(csv).toMatch(/\r\n/);
    expect(csv).toMatch(/振込年月日,支払先番号,カード会社,締日,支払区分,売上件数,売上金額,手数料率,手数料,振込金額/);
    expect(csv).toContain("SAISON");
    expect(csv).toContain("156742401");
  });
});
