import { describe, it, expect } from "vitest";
import { parseSaisonPdfText } from "@/lib/pdf/saison-pdf-text";

/**
 * 実セゾン支払計算書PDFのpdfjs抽出テキストを再現した固定値。
 * フォーム型レイアウトのためラベルと値が別行に分かれ、"P.店舗番号" が無い。
 * （2077247_20260630.pdf を pdfjs で抽出した実構造）
 */
const REAL_TEXT = [
  "（株）クレディセゾン",
  "株）ユニバ－サル・デベロップメント   2026   06   20",
  "加盟店ＮＯ：   2077247   #  ",
  "2026   6   1   2026   6   15",
  "2026年 6月30日",
  "三井住友銀行   築地",
  "普通   7334783",
  "26   06   11 １回払   4   2200",
  "合   計   4   2200",
  "2200   2200   57   2143",
  "2200   2200   57   2143",
  "2143",
].join("\n");

describe("parseSaisonPdfText（実明細フォーマット）", () => {
  it("ラベルと値が別行・P.番号なしの実明細を正しくパースする", () => {
    const d = parseSaisonPdfText(REAL_TEXT);
    expect(d.merchantNo).toBe("2077247");
    expect(d.merchantStoreNo).toBe("2077247"); // P.番号が無いので加盟店NOを店舗Noに採用
    expect(d.closingDate).toBe("2026/06/15");
    expect(d.transferDate).toBe("2026/06/30");
    expect(d.totalAmount).toBe(2200);
    expect(d.totalFee).toBe(57);
    expect(d.totalTransfer).toBe(2143);
  });
});
