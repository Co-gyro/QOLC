/**
 * usen-master（USEN加盟店マスタ登録CSV生成）のテスト
 * 期待値は 04_USEN/UD_20260528_QOLCテスト.csv（実送付ファイル）準拠。
 */
import { describe, it, expect } from "vitest";

import {
  USEN_MASTER_HEADER,
  buildUsenMasterCsv,
  buildUsenFilename,
  toSjisBytes,
  validateUsenMaster,
  type UsenMasterInput,
} from "@/lib/merchant-application/usen-master";

const INPUT: UsenMasterInput = {
  mallCode: "A3F2",
  terminalId: "3124620001042",
  salesName: "SAMPLE CARE HOME",
  receiptName: "サンプルケアホーム",
  saisonMerchantCode: "2077248",
  jcbMerchantCode: "24111748400002",
};

describe("buildUsenMasterCsv", () => {
  it("ヘッダは実送付ファイルと同じ21列", () => {
    expect(USEN_MASTER_HEADER).toHaveLength(21);
    expect(USEN_MASTER_HEADER[0]).toBe("登録識別子");
    expect(USEN_MASTER_HEADER[20]).toBe("利用可能サービス");
  });

  it("全項目ダブルクォート・CRLF・固定値（UD/支払区分10/credit）で生成する", () => {
    const csv = buildUsenMasterCsv(INPUT);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(3); // ヘッダ + 1行 + 末尾CRLFの空要素
    expect(lines[2]).toBe("");
    const row = lines[1].split(",");
    expect(row).toHaveLength(21);
    expect(row[0]).toBe('"UD"');
    expect(row[1]).toBe('"A3F2"');
    expect(row[2]).toBe('"SAMPLE CARE HOME"');
    expect(row[3]).toBe('"サンプルケアホーム"');
    expect(row[6]).toBe('"3124620001042"');
    expect(row[7]).toBe('"10"'); // VM支払区分
    expect(row[8]).toBe('"2077248"');
    expect(row[10]).toBe('"10"'); // JCB支払区分
    expect(row[11]).toBe('"24111748400002"');
    expect(row[20]).toBe('"credit"');
    // 未使用列（銀聯・QR・DINERS等）は空のクォート
    for (const i of [4, 5, 9, 12, 13, 14, 15, 16, 17, 18, 19]) {
      expect(row[i]).toBe('""');
    }
  });

  it("Shift-JIS に変換できる（UTF-8より短く、SJISカナのバイト列を含む）", () => {
    const csv = buildUsenMasterCsv(INPUT);
    const bytes = toSjisBytes(csv);
    // 日本語はSJISで2バイト・UTF-8で3バイト → SJISの方が短い
    expect(bytes.length).toBeLessThan(new TextEncoder().encode(csv).length);
    // SJISの「サ」= 0x83 0x54 の連続が含まれる（サンプルケアホーム）
    const arr = Array.from(bytes);
    const idx = arr.findIndex((b, i) => b === 0x83 && arr[i + 1] === 0x54);
    expect(idx).toBeGreaterThan(-1);
  });
});

describe("validateUsenMaster", () => {
  it("揃っていればエラーなし", () => {
    expect(validateUsenMaster(INPUT)).toEqual([]);
  });

  it("不足項目ごとに「先に何をすべきか」が分かるメッセージを返す", () => {
    const errors = validateUsenMaster({});
    expect(errors.join()).toContain("採番");
    expect(errors.join()).toContain("店舗名アルファベット");
    expect(errors.join()).toContain("SAISON加盟店番号");
    expect(errors.join()).toContain("JCB加盟店番号");
  });

  it("店舗名アルファベットの形式（小文字・26文字超）を弾く", () => {
    expect(validateUsenMaster({ ...INPUT, salesName: "sample" }).join()).toContain(
      "店舗名アルファベット"
    );
    expect(validateUsenMaster({ ...INPUT, salesName: "A".repeat(26) }).join()).toContain(
      "店舗名アルファベット"
    );
  });
});

describe("buildUsenFilename", () => {
  it("実例準拠の UD_YYYYMMDD_名称.csv 形式", () => {
    expect(buildUsenFilename("サンプルケアホーム", { year: 2026, month: 7, day: 22 })).toBe(
      "UD_20260722_サンプルケアホーム.csv"
    );
  });

  it("ファイル名に使えない文字を除去する", () => {
    expect(buildUsenFilename('テスト/施設:"A"', { year: 2026, month: 1, day: 5 })).toBe(
      "UD_20260105_テスト施設A.csv"
    );
  });
});
