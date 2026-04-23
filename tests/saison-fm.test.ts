import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

import {
  aggregateFm,
  parseSaisonCsv,
  renderFmCsv,
  encodeShiftJis,
  type FmPerClosingFile,
} from "@/lib/csv/saison-fm";

async function loadSaisonCsv(): Promise<ReturnType<typeof parseSaisonCsv>> {
  const buf = await readFile("test-data/セゾン_売上データCSV_ダミー.csv");
  const text = new TextDecoder("shift-jis").decode(buf);
  return parseSaisonCsv(text);
}

function findClosing(files: FmPerClosingFile[], yyyymmdd: string) {
  const f = files.find((x) => x.closingYyyymmdd === yyyymmdd);
  if (!f) throw new Error(`closing ${yyyymmdd} not found`);
  return f;
}

describe("parseSaisonCsv", () => {
  it("parses 16 rows from ダミーCSV", async () => {
    const rows = await loadSaisonCsv();
    expect(rows.length).toBe(16);
    expect(rows[0]).toMatchObject({
      締年月日: "20260315",
      加盟店店舗No: "0000001",
      加盟店名: expect.stringContaining("A"),
      支払方法: "1回払い",
      売上合計: 35000,
    });
  });
});

describe("aggregateFm (README期待値)", () => {
  it("0315締め 施設A: 件数5 / 売上130,000 / 手数料4,225 / 振込125,775", async () => {
    const rows = await loadSaisonCsv();
    const files = aggregateFm(rows, {
      transferDate: "2026/03/31",
      payeeNumber: "156742401",
      feeRatePercent: 3.25,
    });

    const f0315 = findClosing(files, "20260315");
    const facilityA = f0315.rows.find((r) => r.加盟店名.includes("A"));
    expect(facilityA).toBeDefined();
    expect(facilityA!.売上件数).toBe(5);
    expect(facilityA!.売上金額).toBe(130000);
    expect(facilityA!.手数料).toBe(4225);
    expect(facilityA!.振込金額).toBe(125775);
  });

  it("0331締め 施設A: 売上220,000 / 手数料7,150 / 振込212,850", async () => {
    const rows = await loadSaisonCsv();
    const files = aggregateFm(rows, {
      transferDate: "2026/04/15",
      payeeNumber: "156742401",
      feeRatePercent: 3.25,
    });
    const f0331 = findClosing(files, "20260331");
    const facilityA = f0331.rows.find((r) => r.加盟店名.includes("A"));
    expect(facilityA).toBeDefined();
    expect(facilityA!.売上金額).toBe(220000);
    expect(facilityA!.手数料).toBe(7150);
    expect(facilityA!.振込金額).toBe(212850);
  });

  it("締日ごとに別ファイル出力 (0315 と 0331 で2ファイル)", async () => {
    const rows = await loadSaisonCsv();
    const files = aggregateFm(rows, {
      transferDate: "2026/03/31",
      payeeNumber: "156742401",
      feeRatePercent: 3.25,
    });
    expect(files.map((f) => f.closingYyyymmdd).sort()).toEqual(["20260315", "20260331"]);
  });
});

describe("renderFmCsv + encodeShiftJis", () => {
  it("CRLF 改行でCSVを出力する", async () => {
    const rows = await loadSaisonCsv();
    const files = aggregateFm(rows, {
      transferDate: "2026/03/31",
      payeeNumber: "156742401",
      feeRatePercent: 3.25,
    });
    const csv = renderFmCsv(files[0]);
    expect(csv).toMatch(/\r\n/);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("Shift-JIS でエンコードしてデコード往復で等価", async () => {
    const rows = await loadSaisonCsv();
    const files = aggregateFm(rows, {
      transferDate: "2026/03/31",
      payeeNumber: "156742401",
      feeRatePercent: 3.25,
    });
    const csv = renderFmCsv(files[0]);
    const bytes = encodeShiftJis(csv);
    const roundTrip = new TextDecoder("shift-jis").decode(bytes);
    expect(roundTrip).toBe(csv);
    // ヘッダー行に期待列が含まれる
    expect(roundTrip).toMatch(/振込年月日,支払先番号,カード会社,締日,加盟店名,売上件数,売上金額,手数料率,手数料,振込金額/);
  });
});
