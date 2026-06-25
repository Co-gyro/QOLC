/**
 * 介護保険給付費請求情報CSV パーサーのユニットテスト
 */
import { describe, it, expect } from "vitest";
import { convert } from "encoding-japanese";
import { parseKaigoCsv } from "../../src/lib/receipt/kaigo-csv";

/**
 * テスト用CSV組み立て: 各行を ["値1","値2",...] にして CRLF 連結
 * 文字列が UTF-8 で返るので、SJIS テストの場合は別途エンコード。
 */
function buildCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\r\n") + "\r\n";
}

function buildSjisBuffer(rows: string[][]): Buffer {
  const text = buildCsv(rows);
  // UTF-8 文字列 → SJIS バイト配列
  const sjisArr = convert(text, { to: "SJIS", from: "UNICODE", type: "array" }) as number[];
  return Buffer.from(sjisArr);
}

describe("parseKaigoCsv", () => {
  it("空入力は空の residents を返す", () => {
    const result = parseKaigoCsv("");
    expect(result.residents).toEqual([]);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it("コントロール+明細書基本+エンドの最小ケース", () => {
    const csv = buildCsv([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      // 明細書基本情報レコード (7131-01): フィールド7=被保番、フィールド36=利用者負担額
      [
        "2", "2", "7131", "01", "202604", "1070206428", "102012", "0001325455",
        "", "", "", "", "", "", "19490813", "2", "21", "", "20221201", "20261130",
        "1", "1070207459", "", "", "", "", "", "", "", "", "90", "", "", "",
        "17004", "157167", "17464", "", "", "", "0", "0", "0",
      ],
      ["3", "3"],
    ]);
    const result = parseKaigoCsv(csv);
    expect(result.facilityNumber).toBe("1070206428");
    expect(result.processingMonth).toBe("202605");
    expect(result.residents).toHaveLength(1);
    expect(result.residents[0]).toMatchObject({
      insuranceNumber: "0001325455",
      insurerNumber: "102012",
      serviceMonth: "202604",
      benefitRatePercent: 90,
      insuranceClaim: 157167,
      userBurden: 17464,
    });
  });

  it("被保険者番号の先頭0を保持する", () => {
    const csv = buildCsv([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      [
        "2", "2", "7131", "01", "202604", "1070206428", "102012", "0000000123",
        ...Array(22).fill(""), "90", "", "", "", "100", "9000", "1000",
      ],
    ]);
    const result = parseKaigoCsv(csv);
    expect(result.residents[0].insuranceNumber).toBe("0000000123");
  });

  it("給付費請求情報サマリーレコード(7111)は residents に入らない", () => {
    const csv = buildCsv([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      [
        "2", "2", "7111", "202604", "1070206428", "1", "0", "01", "30",
        "837468", "8600779", "7674502", "102768", "823509",
      ],
      ["3", "3"],
    ]);
    const result = parseKaigoCsv(csv);
    expect(result.residents).toEqual([]);
  });

  it("サービス明細(7131-02)は residents に追加しない（重複防止）", () => {
    const csv = buildCsv([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      [
        "2", "2", "7131", "01", "202604", "1070206428", "102012", "0001325455",
        ...Array(22).fill(""), "90", "", "", "", "100", "9000", "1000",
      ],
      // サービス明細(02)
      ["2", "3", "7131", "02", "202604", "1070206428", "102012", "0001325455",
       "15", "2241", "370", "1", "0", "0", "0", "370", "0", "0", "0", ""],
    ]);
    const result = parseKaigoCsv(csv);
    expect(result.residents).toHaveLength(1);
    expect(result.residents[0].insuranceNumber).toBe("0001325455");
  });

  it("利用者負担額が0の場合は ZERO_USER_BURDEN 警告を出す", () => {
    const csv = buildCsv([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      [
        "2", "2", "7131", "01", "202604", "1070206428", "102012", "0001325455",
        ...Array(22).fill(""), "90", "", "", "", "100", "9000", "0",
      ],
    ]);
    const result = parseKaigoCsv(csv);
    expect(result.residents[0].userBurden).toBe(0);
    expect(result.warnings.some((w) => w.code === "ZERO_USER_BURDEN")).toBe(true);
  });

  it("被保険者番号が空の場合は MISSING_INSURANCE_NUMBER 警告でスキップ", () => {
    const csv = buildCsv([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      [
        "2", "2", "7131", "01", "202604", "1070206428", "102012", "",
        ...Array(22).fill(""), "90", "", "", "", "100", "9000", "1000",
      ],
    ]);
    const result = parseKaigoCsv(csv);
    expect(result.residents).toEqual([]);
    expect(result.warnings.some((w) => w.code === "MISSING_INSURANCE_NUMBER")).toBe(true);
  });

  it("SJIS バイナリ Buffer を渡しても正しく decode してパースできる", () => {
    const buf = buildSjisBuffer([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      [
        "2", "2", "7131", "01", "202604", "1070206428", "102012", "0001325455",
        ...Array(22).fill(""), "90", "", "", "", "100", "9000", "1000",
      ],
    ]);
    const result = parseKaigoCsv(buf);
    expect(result.residents[0].insuranceNumber).toBe("0001325455");
    expect(result.residents[0].userBurden).toBe(1000);
  });

  it("区分02のサービス明細を被保険者番号で対応付けて捕捉する", () => {
    // 実サンプル(通所介護 KS202604)準拠の区分02行
    const csv = buildCsv([
      ["1", "1", "0", "261", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      [
        "2", "4", "7131", "01", "202604", "1070206428", "102012", "0001325455",
        ...Array(22).fill(""), "90", "", "", "", "17004", "157167", "17464",
      ],
      // [8]種類15 [9]項目2241 [10]単位370 [11]回数1 [15]合計370
      ["2", "5", "7131", "02", "202604", "1070206428", "102012", "0001325455", "15", "2241", "370", "1", "0", "0", "0", "370", "0", "0", "0", ""],
      // 加算: [9]2246 [10]388 [11]8 [15]3104
      ["2", "6", "7131", "02", "202604", "1070206428", "102012", "0001325455", "15", "2246", "388", "8", "0", "0", "0", "3104", "0", "0", "0", ""],
      // 減算（合計が負）: [9]4111 [10]空 [11]1 [15]-777
      ["2", "7", "7131", "02", "202604", "1070206428", "102012", "0001325455", "15", "4111", "", "1", "0", "0", "0", "-777", "0", "0", "0", ""],
      ["3", "3"],
    ]);
    const result = parseKaigoCsv(csv);
    const r = result.residents[0];
    expect(r.serviceDetails).toHaveLength(3);
    expect(r.serviceDetails[0]).toEqual({
      serviceTypeCode: "15",
      serviceItemCode: "2241",
      unitScore: 370,
      count: 1,
      totalUnits: 370,
    });
    expect(r.serviceDetails[1].count).toBe(8);
    expect(r.serviceDetails[1].totalUnits).toBe(3104);
    // 減算は負の合計を保持
    expect(r.serviceDetails[2].totalUnits).toBe(-777);
  });

  it("区分01が無い被保険者の区分02は無視される（対応付け不可）", () => {
    const csv = buildCsv([
      ["1", "1", "0", "1", "711", "0", "0", "1070206428", "0", "7", "202605", "0"],
      ["2", "5", "7131", "02", "202604", "1070206428", "102012", "9999999999", "15", "2241", "370", "1", "0", "0", "0", "370", "0", "0", "0", ""],
    ]);
    const result = parseKaigoCsv(csv);
    expect(result.residents).toEqual([]);
  });
});
