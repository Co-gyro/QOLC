/**
 * kana（全角カタカナ→半角カナ変換）のテスト
 */
import { describe, it, expect } from "vitest";

import { toHalfWidthKana, FULL_KATAKANA_RE } from "@/lib/utils/kana";

describe("toHalfWidthKana", () => {
  it("清音・長音を変換する", () => {
    expect(toHalfWidthKana("サンプルケア")).toBe("ｻﾝﾌﾟﾙｹｱ");
    expect(toHalfWidthKana("トーキョー")).toBe("ﾄｰｷｮｰ");
  });

  it("濁点・半濁点は2文字に分解する", () => {
    expect(toHalfWidthKana("ユニバーサルデベロップメント")).toBe("ﾕﾆﾊﾞｰｻﾙﾃﾞﾍﾞﾛｯﾌﾟﾒﾝﾄ");
    expect(toHalfWidthKana("パピプペポ")).toBe("ﾊﾟﾋﾟﾌﾟﾍﾟﾎﾟ");
    expect(toHalfWidthKana("ヴ")).toBe("ｳﾞ");
  });

  it("小書き・促音・全角スペースを変換する", () => {
    expect(toHalfWidthKana("キャッシュ")).toBe("ｷｬｯｼｭ");
    expect(toHalfWidthKana("ケア　ホーム")).toBe("ｹｱ ﾎｰﾑ");
  });

  it("対応表にない文字（半角カナ・英数字）はそのまま通す", () => {
    expect(toHalfWidthKana("ｹｱABC123")).toBe("ｹｱABC123");
  });
});

describe("FULL_KATAKANA_RE（フリガナ入力の検証）", () => {
  it("全角カタカナ・長音・スペース・中点を許容する", () => {
    expect(FULL_KATAKANA_RE.test("カブシキガイシャ　サンプル・ケアー")).toBe(true);
  });

  it("ひらがな・漢字・英数字は弾く", () => {
    expect(FULL_KATAKANA_RE.test("さんぷる")).toBe(false);
    expect(FULL_KATAKANA_RE.test("株式会社")).toBe(false);
    expect(FULL_KATAKANA_RE.test("ABC")).toBe(false);
    expect(FULL_KATAKANA_RE.test("")).toBe(false);
  });
});
