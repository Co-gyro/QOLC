import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import {
  applicationToStoreRow,
  buildStoreExcelFilename,
  EMPTY_STORE_EXTRAS,
  generateJcbStoreExcel,
  STORE_AUTO_VALUES,
  validateStoreExtras,
  type JcbStoreExtras,
} from "@/lib/merchant-application/jcb-store";
import type { JcbEcApplication } from "@/lib/merchant-application/jcb-ec";

const baseApp: JcbEcApplication = {
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
  bizOverview: "介護施設の運営",
  handlingProducts: "介護サービス",
  notes: "店頭版テスト",
  contractCode: "654321",
  merchantUseNo: "MALL001",
  posBranchCode1: "9999999999991",
};

const filledExtras: JcbStoreExtras = {
  storeSalesStyle: "01",
  icSetStatus: "1",
  posBranchCode2: "9999999999992",
  posBranchCode3: "",
  posBranchCode4: "",
  posBranchCode5: "",
  qpPosBranchCode1: "8888888888881",
  qpPosBranchCode2: "8888888888882",
  qpPosBranchCode3: "",
  qpPosBranchCode4: "",
  qpPosBranchCode5: "",
  transSprwid1: "ABC1234567890",
  transSprwid2: "",
  transSprwid3: "",
  transSprwid4: "",
  transSprwid5: "",
};

describe("applicationToStoreRow (店頭版71カラム)", () => {
  it("仕様通りの列順で値を配置 (店舗形態/IC端末/QUICPay/SPRWIDなど)", () => {
    const row = applicationToStoreRow(baseApp, filledExtras);
    expect(row.length).toBe(71);
    expect(row[0]).toBe("1");                    // 申請区分
    expect(row[1]).toBe("0160");                 // 包括事業者コード
    expect(row[2]).toBe("654321");               // 契約コード
    expect(row[4]).toBe("1");                    // 法人/個人区分
    expect(row[16]).toBe("19800401");            // 代表者生年月日
    expect(row[21]).toBe("テスト介護施設A");        // 店舗名(漢字)
    expect(row[23]).toBe("TEST KAIGO A");        // 店舗名(アルファベット)
    expect(row[30]).toBe("01");                  // 店舗形態 (店頭版固有 col 31)
    expect(row[37]).toBe("2");                   // カード情報保持状況 (col 38)
    expect(row[38]).toBe("1");                   // PCIDSS準拠状況 (col 39)
    expect(row[39]).toBe("1");                   // IC端末設置状況 (col 40, 店頭版固有)
    expect(row[40]).toBe("9999999999991");       // クレジットPOS(1) (col 41)
    expect(row[41]).toBe("9999999999992");       // クレジットPOS(2)
    expect(row[45]).toBe("8888888888881");       // QUICPay/iD POS(1) (col 46)
    expect(row[50]).toBe("ABC1234567890");       // 交通系SPRWID(1) (col 51)
    expect(row[57]).toBe("MALL001");             // 包括加盟店使用番号 (col 58)
    expect(row[60]).toBe("店頭版テスト");           // 備考 (col 61)
    // 結果報告系 (col 62-71) は全てブランク
    for (let i = 61; i < 71; i++) expect(row[i]).toBe("");
  });

  it("EC版に存在する J/Secure / J/S Merchant Name 等の列は店頭版には現れない", () => {
    const row = applicationToStoreRow(baseApp, filledExtras);
    // 店舗形態の直後 (col 32-33) は業種業務内容 / 取扱商材 で、J/Secureなどは出てこない
    expect(row[31]).toBe("介護施設の運営");          // 業種業務内容 (col 32)
    expect(row[32]).toBe("介護サービス");            // 取扱商材 (col 33)
    // EC版の "TEST KAIGO A" は J/S Merchant Name (col 39) に重複コピーされるが
    // 店頭版の col 39 は PCIDSS準拠状況なので "1" になる
    expect(row[38]).toBe("1");
  });

  it("個人区分なら会社情報がブランクになり代表者住所が入る", () => {
    const row = applicationToStoreRow(
      { ...baseApp, corpIndiv: "3", repPostalCode: "1058500", repAddrKanji: "東京都港区赤坂", repAddrKana: "ﾄｳｷﾖｳﾄﾐﾅﾄｸｱｶｻｶ", repTel: "090-0000-0000" },
      filledExtras,
    );
    expect(row[4]).toBe("3");
    expect(row[5]).toBe("");           // 会社名(漢字)
    expect(row[11]).toBe("");          // 会社法人番号
    expect(row[17]).toBe("1058500");   // 代表者郵便番号
    expect(row[20]).toBe("090-0000-0000");
  });
});

describe("validateStoreExtras", () => {
  it("空のEMPTY_STORE_EXTRASはエラーなし", () => {
    const issues = validateStoreExtras(EMPTY_STORE_EXTRAS);
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("POS支店コード(2)が13桁未満ならエラー", () => {
    const issues = validateStoreExtras({ ...EMPTY_STORE_EXTRAS, posBranchCode2: "12345" });
    expect(issues.find((i) => i.level === "error" && i.message.includes("posBranchCode2"))).toBeDefined();
  });

  it("QUICPay/iD POS支店コードに英字が混じるとエラー", () => {
    const issues = validateStoreExtras({ ...EMPTY_STORE_EXTRAS, qpPosBranchCode1: "ABC1234567890" });
    expect(issues.find((i) => i.level === "error" && i.message.includes("qpPosBranchCode1"))).toBeDefined();
  });

  it("交通系SPRWIDにハイフンが混じるとエラー", () => {
    const issues = validateStoreExtras({ ...EMPTY_STORE_EXTRAS, transSprwid1: "ABCD-12345-67" });
    expect(issues.find((i) => i.level === "error" && i.message.includes("transSprwid1"))).toBeDefined();
  });

  it("交通系SPRWIDが13桁の英数字なら通る", () => {
    const issues = validateStoreExtras({ ...EMPTY_STORE_EXTRAS, transSprwid1: "ABC1234567890" });
    expect(issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("クレジットPOS(2-5)が重複するとエラー", () => {
    const issues = validateStoreExtras({
      ...EMPTY_STORE_EXTRAS,
      posBranchCode2: "9999999999992",
      posBranchCode3: "9999999999992",
    });
    expect(issues.find((i) => i.message.includes("クレジット") && i.message.includes("重複"))).toBeDefined();
  });

  it("QUICPay/iD POS が重複するとエラー", () => {
    const issues = validateStoreExtras({
      ...EMPTY_STORE_EXTRAS,
      qpPosBranchCode1: "8888888888881",
      qpPosBranchCode2: "8888888888881",
    });
    expect(issues.find((i) => i.message.includes("QUICPay") && i.message.includes("重複"))).toBeDefined();
  });
});

describe("generateJcbStoreExcel", () => {
  it("xlsxバイナリを生成 + 読み戻して列構造と固有項目位置を検証", async () => {
    const bytes = await generateJcbStoreExcel(baseApp, filledExtras);
    expect(bytes.byteLength).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as unknown as Parameters<typeof wb.xlsx.load>[0]);
    const ws = wb.getWorksheet("【別紙】申請データFMT");
    expect(ws).toBeDefined();
    expect(ws!.getRow(1).cellCount).toBe(71);
    expect(ws!.getRow(1).getCell(31).value).toBe("店舗形態");
    expect(ws!.getRow(1).getCell(40).value).toBe("IC端末設置状況");
    expect(ws!.getRow(1).getCell(46).value).toBe("QUICPay/iD用POS支店コード(1)");
    expect(ws!.getRow(1).getCell(51).value).toBe("交通系SPRWID(1)");
    expect(ws!.getRow(1).getCell(71).value).toBe("結果報告準備完了日");

    const data = ws!.getRow(2);
    expect(data.getCell(31).value).toBe("01");
    expect(data.getCell(40).value).toBe("1");
    expect(data.getCell(46).value).toBe("8888888888881");
    expect(data.getCell(51).value).toBe("ABC1234567890");
  });
});

describe("buildStoreExcelFilename", () => {
  it("店頭プレフィックス付きで店舗名と日付を組み合わせる", () => {
    const date = new Date("2026-04-30T12:00:00Z");
    const name = buildStoreExcelFilename("テスト介護施設A", date);
    expect(name).toMatch(/^JCB_店頭_申請_テスト介護施設A_\d{8}\.xlsx$/);
  });
});

describe("STORE_AUTO_VALUES", () => {
  it("店頭版の固定値: J/Secure系は存在せず、必要な値のみ", () => {
    expect(STORE_AUTO_VALUES.requestType).toBe("1");
    expect(STORE_AUTO_VALUES.enterpriseCode).toBe("0160");
    expect(STORE_AUTO_VALUES.cardInfoRetainStatus).toBe("2");
    expect(STORE_AUTO_VALUES.pcidssComplStatus).toBe("1");
    // J/Secure などはオブジェクトに存在しない
    expect("jSecure2" in STORE_AUTO_VALUES).toBe(false);
    expect("protectBuy" in STORE_AUTO_VALUES).toBe(false);
    expect("amexSafekey" in STORE_AUTO_VALUES).toBe(false);
  });
});
