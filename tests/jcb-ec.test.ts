import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import {
  AUTO_VALUES,
  applicationToRow,
  buildExcelFilename,
  generateJcbEcExcel,
  validateApplication,
  type JcbEcApplication,
} from "@/lib/merchant-application/jcb-ec";

const validSample: JcbEcApplication = {
  corpIndiv: "1",
  companyNameKanji: "株式会社テスト介護",
  companyPostalCode: "1058555",
  companyAddrKanji: "東京都港区南青山5-1-22",
  companyTel: "03-1234-5678",
  corpNo: "1234567890123",
  repFamilyNameKanji: "山田",
  repNameKanji: "太郎",
  repBirthday: "1980-04-01",
  tenantNameKanji: "テスト介護施設A",
  tenantPostalCode: "1058556",
  tenantAddrKanji: "東京都港区南青山5-1-22",
  tenantTel: "03-1234-5679",
  companyNameKana: "ｶﾌﾞｼｷｶﾞｲｼﾔﾃｽﾄｶｲｺﾞ",
  companyAddrKana: "ﾄｳｷﾖｳﾄﾐﾅﾄｸﾐﾅﾐｱｵﾔﾏ5-1-22",
  repFamilyNameKana: "ﾔﾏﾀﾞ",
  repNameKana: "ﾀﾛｳ",
  repPostalCode: "",
  repAddrKanji: "",
  repAddrKana: "",
  repTel: "",
  tenantNameKana: "ﾃｽﾄｶｲｺﾞｼｾﾂｴｰ",
  tenantNameLatin: "TEST KAIGO A",
  tenantAddrKana: "ﾄｳｷﾖｳﾄﾐﾅﾄｸﾐﾅﾐｱｵﾔﾏ5-1-22",
  tenantURL: "",
  bizCatCode: "12345",
  salesStyle: "04",
  bizOverview: "介護施設の運営および介護サービスの提供",
  handlingProducts: "介護サービス、食事提供、リハビリテーション",
  notes: "テスト申請",
  contractCode: "654321",
  merchantUseNo: "MALL001",
  posBranchCode1: "9999999999999",
};

describe("applicationToRow (71カラム)", () => {
  it("法人(法人番号有)で正しい列順を生成する", () => {
    const row = applicationToRow(validSample);
    expect(row.length).toBe(71);
    expect(row[0]).toBe("1");                   // 申請区分
    expect(row[1]).toBe("0160");                // 包括事業者コード
    expect(row[2]).toBe("654321");              // 契約コード
    expect(row[3]).toBe("");                    // 対象加盟店番号 (新規ブランク)
    expect(row[4]).toBe("1");                   // 法人/個人区分
    expect(row[5]).toBe("株式会社テスト介護");      // 会社名(漢字)
    expect(row[11]).toBe("1234567890123");      // 会社法人番号
    expect(row[16]).toBe("19800401");           // 代表者生年月日 (YYYYMMDD化)
    expect(row[21]).toBe("テスト介護施設A");        // 店舗名(漢字)
    expect(row[23]).toBe("TEST KAIGO A");       // 店舗名(アルファベット)
    expect(row[37]).toBe("1");                  // J/Secure(2.0) 有無 (自動)
    expect(row[38]).toBe("TEST KAIGO A");       // J/S Merchant Name (自動コピー)
    expect(row[41]).toBe("2");                  // カード情報保持状況 (非保持)
    expect(row[42]).toBe("1");                  // PCIDSS準拠状況 (準拠)
    expect(row[49]).toBe("9999999999999");      // POS支店コード(1)
    expect(row[56]).toBe("MALL001");            // 包括加盟店使用番号
    expect(row[60]).toBe("テスト申請");           // 備考
    // 結果報告系 (62-71) は全てブランク
    for (let i = 61; i < 71; i++) expect(row[i]).toBe("");
  });

  it("個人区分の場合は会社情報をブランクにし、代表者住所を入れる", () => {
    const row = applicationToRow({
      ...validSample,
      corpIndiv: "3",
      repPostalCode: "1058500",
      repAddrKanji: "東京都港区赤坂",
      repAddrKana: "ﾄｳｷﾖｳﾄﾐﾅﾄｸｱｶｻｶ",
      repTel: "090-1234-5678",
    });
    expect(row[4]).toBe("3");
    expect(row[5]).toBe(""); // 会社名(漢字)
    expect(row[11]).toBe(""); // 会社法人番号
    expect(row[17]).toBe("1058500"); // 代表者郵便番号
    expect(row[18]).toBe("東京都港区赤坂"); // 代表者住所(漢字)
    expect(row[20]).toBe("090-1234-5678"); // 代表者電話番号
  });

  it("法人(法人番号無)では会社情報は入るが法人番号はブランク", () => {
    const row = applicationToRow({ ...validSample, corpIndiv: "2", corpNo: "1234567890123" });
    expect(row[4]).toBe("2");
    expect(row[5]).toBe("株式会社テスト介護"); // 会社名は入る
    expect(row[11]).toBe(""); // 法人番号はブランク
  });
});

describe("validateApplication", () => {
  it("正常データでエラーなし", () => {
    const issues = validateApplication(validSample);
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("必須項目漏れを検出", () => {
    const issues = validateApplication({ ...validSample, tenantNameKanji: "" });
    expect(issues.find((i) => i.field === "tenantNameKanji" && i.level === "error")).toBeDefined();
  });

  it("カナに拗音が含まれる場合はwarning", () => {
    const issues = validateApplication({ ...validSample, repNameKana: "ﾀｯｸﾝ" });
    expect(issues.find((i) => i.field === "repNameKana" && i.level === "warning")).toBeDefined();
  });

  it("郵便番号は7桁数字必須", () => {
    const issues = validateApplication({ ...validSample, tenantPostalCode: "12345" });
    expect(issues.find((i) => i.field === "tenantPostalCode" && i.level === "error")).toBeDefined();
  });

  it("法人番号は13桁必須", () => {
    const issues = validateApplication({ ...validSample, corpNo: "12345" });
    expect(issues.find((i) => i.field === "corpNo" && i.level === "error")).toBeDefined();
  });

  it("店舗名アルファベットは大文字のみ", () => {
    const issues = validateApplication({ ...validSample, tenantNameLatin: "test KAIGO" });
    expect(issues.find((i) => i.field === "tenantNameLatin" && i.level === "error")).toBeDefined();
  });

  it("代表者18歳未満はエラー", () => {
    const today = new Date();
    const recentBirth = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate());
    const iso = recentBirth.toISOString().slice(0, 10);
    const issues = validateApplication({ ...validSample, repBirthday: iso });
    expect(issues.find((i) => i.field === "repBirthday" && i.level === "error" && i.message.includes("18歳"))).toBeDefined();
  });

  it("法人(法人番号無)の場合、法人番号必須エラーは出ない", () => {
    const issues = validateApplication({ ...validSample, corpIndiv: "2", corpNo: "" });
    expect(issues.find((i) => i.field === "corpNo" && i.level === "error")).toBeUndefined();
  });

  it("個人の場合、代表者住所/郵便番号/電話番号が必須", () => {
    const issues = validateApplication({
      ...validSample,
      corpIndiv: "3",
      repPostalCode: "",
      repAddrKanji: "",
      repAddrKana: "",
      repTel: "",
    });
    const errs = issues.filter((i) => i.level === "error").map((i) => i.field);
    expect(errs).toContain("repPostalCode");
    expect(errs).toContain("repAddrKanji");
    expect(errs).toContain("repAddrKana");
    expect(errs).toContain("repTel");
  });
});

describe("generateJcbEcExcel", () => {
  it("xlsxバイナリを生成 + 読み戻して列構造を検証", async () => {
    const bytes = await generateJcbEcExcel(validSample);
    expect(bytes.byteLength).toBeGreaterThan(1000); // 妥当なサイズ

    const wb = new ExcelJS.Workbook();
    // exceljsのBuffer型はNode版で型が古いためcastで通す
    await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("【別紙】申請データFMT");
    expect(ws).toBeDefined();
    expect(ws!.getRow(1).cellCount).toBe(71);
    expect(ws!.getRow(1).getCell(1).value).toBe("申請区分");
    expect(ws!.getRow(1).getCell(38).value).toBe("J/Secure（2.0)有無");
    expect(ws!.getRow(1).getCell(71).value).toBe("結果報告準備完了日");

    const data = ws!.getRow(2);
    expect(data.getCell(1).value).toBe("1"); // 申請区分
    expect(data.getCell(2).value).toBe("0160"); // 包括事業者コード
    expect(data.getCell(38).value).toBe("1"); // J/Secure(2.0)有無
    expect(data.getCell(39).value).toBe("TEST KAIGO A"); // J/S Merchant Name
  });
});

describe("buildExcelFilename", () => {
  it("店舗名と日付を組み合わせる", () => {
    const date = new Date("2026-04-30T12:00:00Z");
    const name = buildExcelFilename("テスト介護施設A", date);
    expect(name).toMatch(/^JCB_EC_申請_テスト介護施設A_\d{8}\.xlsx$/);
  });

  it("ファイル名に使えない文字を _ に置換", () => {
    const name = buildExcelFilename("a/b:c*d?e\"f<g>h|i", new Date("2026-04-30"));
    expect(name).not.toMatch(/[\\/:*?"<>|]/);
  });
});

describe("AUTO_VALUES (固定値)", () => {
  it("仕様通りの定数", () => {
    expect(AUTO_VALUES.requestType).toBe("1");
    expect(AUTO_VALUES.enterpriseCode).toBe("0160");
    expect(AUTO_VALUES.jSecure2).toBe("1");
    expect(AUTO_VALUES.cardInfoRetainStatus).toBe("2");
    expect(AUTO_VALUES.pcidssComplStatus).toBe("1");
  });
});
