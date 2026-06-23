import { describe, it, expect } from "vitest";
import {
  deriveShimebiFromSaleDate,
  deriveShimebiFromTransferDate,
  saisonPayCode,
  ratioToPercent,
  buildJcbFi,
  buildJcbFm,
  buildSaisonFi,
  buildSaisonFm,
  parseJcbTransferCsv,
  parseJcbUrCsv,
  renderCommonFi,
  renderCommonFm,
  type JcbTransferRow,
  type JcbUrRow,
} from "@/lib/csv/selfish-common";
import type { SaisonSalesRow } from "@/lib/csv/saison-fm";
import type { SaisonPdfData } from "@/lib/pdf/saison-pdf";

describe("締日の算出（15日締めサイクル）", () => {
  it("売上日から順算: 1-15日→当月15日 / 16-末→当月末", () => {
    expect(deriveShimebiFromSaleDate("2026/06/11")).toBe("2026/06/15");
    expect(deriveShimebiFromSaleDate("2026/06/15")).toBe("2026/06/15");
    expect(deriveShimebiFromSaleDate("2026/06/20")).toBe("2026/06/30");
    expect(deriveShimebiFromSaleDate("2026/02/20")).toBe("2026/02/28");
  });
  it("振込日から逆算: 当月末振込→当月15日 / 15日振込→前月末", () => {
    expect(deriveShimebiFromTransferDate("2026/06/30")).toBe("2026/06/15");
    expect(deriveShimebiFromTransferDate("2026/06/15")).toBe("2026/05/31");
    expect(deriveShimebiFromTransferDate("2026/01/15")).toBe("2025/12/31");
  });
});

describe("支払区分・手数料率", () => {
  it("SAISON名称→コード", () => {
    expect(saisonPayCode("1回払い")).toBe("10");
    expect(saisonPayCode("ボーナス1回払い")).toBe("21");
    expect(saisonPayCode("2回払い")).toBe("69");
    expect(saisonPayCode("分割払い")).toBe("61");
    expect(saisonPayCode("リボ払い")).toBe("80");
  });
  it("手数料率: 比率→百分率", () => {
    expect(ratioToPercent(0.0255)).toBe(2.55);
  });
});

describe("JCB 共通FI/FM（実データ期待値）", () => {
  const transfer: JcbTransferRow = {
    振込年月日: "2026/06/30", 支払先番号: "156742401", 支払区分: "10", 支払区分名: "１回払い",
    売上件数: 5, 売上金額: 53300, 手数料率: 0.0255, 手数料: 1359, 振込金額: 51941,
  };
  const ur: JcbUrRow[] = [100, 100, 1000, 2100, 50000].map((amt) => ({
    売上年月日: "2026/06/11", 加盟店番号: "24111748400001", 加盟店名: "ユニバーサル・デベロップメント〔汎用〕",
    支払区分: "10", 支払区分名: "１回払い", 売上金額: amt, 支払先番号: "156742401", 振込年月日: "2026/06/30",
  }));

  it("FI: 締日算出・手数料率×100", () => {
    const [r] = buildJcbFi([transfer]);
    expect(r).toMatchObject({
      振込年月日: "2026/06/30", カード会社: "JCB", 締日: "2026/06/15", 支払区分: "10",
      売上件数: 5, 売上金額: 53300, 手数料率: 2.55, 手数料: 1359, 振込金額: 51941,
    });
  });
  it("FM: 加盟店14桁・集計日・締日・集計", () => {
    const rows = buildJcbFm(ur);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      カード会社: "JCB", 加盟店番号: "24111748400001", 締日: "2026/06/15",
      集計日: "2026/06/11", 支払区分: "10", 売上件数: 5, 売上金額: 53300,
    });
  });
});

describe("JCB CSVパーサ（実ヘッダ・余分な列込み）→ 共通変換", () => {
  const transferCsv =
    "振込年月日,支払先番号,加盟店契約番号,契約内容,ブランド区分,ブランド名,支払区分,支払区分名,売上件数,売上金額,手数料率,手数料,その他精算,振込金額\r\n" +
    "2026/06/30,156742401,006349610,株式会社ユニバーサル・デベロップメント,01001,ＪＣＢカード,10,１回払い,5,53300,0.0255,1359,,51941\r\n";
  const urCsv =
    "売上年月日,加盟店番号,加盟店名,利用明細書表示名,ブランド区分,ブランド名,支払区分,支払区分名,売上金額,カード番号,売上票照会コード,端末識別番号,承認番号,伝票番号,登録方法,支払先番号,振込年月日,ステータス\r\n" +
    "2026/06/11,24111748400001,ユニバーサル,ユニバーサル,01001,ＪＣＢカード,10,１回払い,53300,358443******6834,2C73D6,,0479929,,,156742401,2026/06/30,確定\r\n";

  it("transfer→FI: 余分な列(その他精算)を無視し正しく抽出・変換", () => {
    const [r] = buildJcbFi(parseJcbTransferCsv(transferCsv));
    expect(r).toMatchObject({ 締日: "2026/06/15", 手数料率: 2.55, 売上金額: 53300, 手数料: 1359, 振込金額: 51941 });
  });
  it("sales_details→FM: 余分な列(売上票照会コード)を無視し集計", () => {
    const [r] = buildJcbFm(parseJcbUrCsv(urCsv));
    expect(r).toMatchObject({
      加盟店番号: "24111748400001", 集計日: "2026/06/11", 締日: "2026/06/15", 売上件数: 1, 売上金額: 53300,
    });
  });
});

describe("SAISON 共通FI/FM（実データ期待値）", () => {
  const sales: SaisonSalesRow[] = [100, 1000, 100, 1000].map((amt) => ({
    締年月日: "20260615", 加盟店No: "2077247", 加盟店店舗No: "2077247",
    加盟店名: "ｶ)ﾕﾆﾊﾞ-ｻﾙ･ﾃﾞﾍﾞﾛﾂﾌﾟﾒﾝﾄ", 支払方法: "1回払い", 受付日: "20260611", 売上合計: amt,
  }));
  const pdf: SaisonPdfData = {
    merchantNo: "2077247", merchantStoreNo: "2077247", merchantName: "",
    closingDate: "2026/06/15", transferDate: "2026/06/30",
    totalAmount: 2200, totalFee: 57, totalTransfer: 2143, rawText: "", extractor: "text-layer",
  };

  it("FI: 締日・手数料率逆算・件数/金額", () => {
    const [r] = buildSaisonFi(sales, pdf, "2077247");
    expect(r).toMatchObject({
      振込年月日: "2026/06/30", 支払先番号: "2077247", カード会社: "SAISON", 締日: "2026/06/15",
      支払区分: "10", 支払区分名: "1回払い", 売上件数: 4, 売上金額: 2200,
      手数料率: 2.59, 手数料: 57, 振込金額: 2143,
    });
  });
  it("FM: 加盟店番号=No+店舗No(14桁)・集計日・締日", () => {
    const rows = buildSaisonFm(sales, pdf, "2077247");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      カード会社: "SAISON", 加盟店番号: "20772472077247", 締日: "2026/06/15",
      集計日: "2026/06/11", 支払区分: "10", 売上件数: 4, 売上金額: 2200,
    });
  });

  it("renderはCRLF・正しいヘッダ", () => {
    const fi = renderCommonFi(buildSaisonFi(sales, pdf, "2077247"));
    expect(fi.startsWith("振込年月日,支払先番号,カード会社,締日,支払区分,支払区分名,売上件数,売上金額,手数料率,手数料,振込金額\r\n")).toBe(true);
    const fm = renderCommonFm(buildSaisonFm(sales, pdf, "2077247"));
    expect(fm).toContain("\r\n");
    expect(fm.split("\r\n")[0]).toBe("振込年月日,支払先番号,カード会社,加盟店番号,加盟店名,締日,集計日,支払区分,支払区分名,売上件数,売上金額");
  });
});
