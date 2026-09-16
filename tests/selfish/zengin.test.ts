import { describe, it, expect } from "vitest";
import { ZENGIN_TEXT_RE, findZenginViolations, suggestZenginKana } from "@/lib/selfish/zengin";

describe("全銀許容文字（Selfish rules.ts と同一集合）", () => {
  it("半角カナ・英大文字・数字・()/-.スペースを許容する", () => {
    expect(ZENGIN_TEXT_RE.test("ﾕﾆﾊﾞｰｻﾙﾃﾞﾍﾞﾛﾂﾌﾟﾒﾝﾄ(ｶ")).toBe(true);
    expect(ZENGIN_TEXT_RE.test("ABC 123 A-B/C.D")).toBe(true);
    expect(ZENGIN_TEXT_RE.test("ｲﾘﾖｳﾎｳｼﾞﾝ ﾏﾙﾏﾙｶｲ")).toBe(true);
  });

  it("全角・ひらがな・中黒・英小文字は違反として列挙する（重複なし）", () => {
    expect(findZenginViolations("ユニバーサル")).toEqual(["ユ", "ニ", "バ", "ー", "サ", "ル"]);
    expect(findZenginViolations("ｶ)ﾕﾆ･ﾃﾞﾍﾞ")).toEqual(["･"]);
    expect(findZenginViolations("abc")).toEqual(["a", "b", "c"]);
    expect(findZenginViolations("ｱｱｱ")).toEqual([]);
  });
});

describe("suggestZenginKana（変換候補の提示）", () => {
  it("全角カタカナ→半角カナ、濁点分解、小書き→大書き、中黒→スペース", () => {
    const r = suggestZenginKana("ユニバーサル・デベロップメント（カ");
    expect(r.ok).toBe(true);
    expect(r.converted).toBe("ﾕﾆﾊﾞｰｻﾙ ﾃﾞﾍﾞﾛﾂﾌﾟﾒﾝﾄ(ｶ");
  });

  it("小書きカナは全銀文字集合に無いので違反扱い（Selfish rules.ts と同じ）", () => {
    expect(findZenginViolations("ﾃﾞﾍﾞﾛｯﾌﾟ")).toEqual(["ｯ"]);
  });

  it("ひらがな・全角英数・英小文字も寄せる", () => {
    const r = suggestZenginKana("いりょうほうじん　まるまるかい　ａｂｃ１２３");
    expect(r.ok).toBe(true);
    expect(r.converted).toBe("ｲﾘﾖｳﾎｳｼﾞﾝ ﾏﾙﾏﾙｶｲ ABC123");
  });

  it("既に全銀文字のみなら同じ値を返す", () => {
    const r = suggestZenginKana("ｶ)ﾕﾆﾊﾞｰｻﾙﾃﾞﾍﾞﾛﾂﾌﾟﾒﾝﾄ");
    expect(r).toEqual({ converted: "ｶ)ﾕﾆﾊﾞｰｻﾙﾃﾞﾍﾞﾛﾂﾌﾟﾒﾝﾄ", ok: true, violations: [] });
  });

  it("漢字が残る場合は ok=false で違反文字を返す（黙って落とさない）", () => {
    const r = suggestZenginKana("医療法人 まるまる会");
    expect(r.ok).toBe(false);
    expect(r.violations).toEqual(["医", "療", "法", "人", "会"]);
  });

  it("空文字は ok=false", () => {
    expect(suggestZenginKana("   ").ok).toBe(false);
  });
});
