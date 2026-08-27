/**
 * 加盟店規約への同意（src/lib/applications/merchant-terms.ts）のテスト。
 *
 * UD は包括加盟店で新規申込店舗の審査は当社が行う建付けのため、
 * 申込時の規約同意は法務上の証跡になる。日時と提示した規約の記録が
 * 欠けないことをここで固定する。
 */
import { describe, it, expect } from "vitest";
import {
  MERCHANT_TERMS_DOCUMENTS,
  buildTermsAgreementRecord,
  formatTermsAgreement,
} from "../../src/lib/applications/merchant-terms";

describe("MERCHANT_TERMS_DOCUMENTS", () => {
  it("クレディセゾンとJCBの加盟店規約を持つ", () => {
    expect(MERCHANT_TERMS_DOCUMENTS.map((d) => d.issuer)).toEqual(["saison", "jcb"]);
  });

  it("全件に名称と https のURLがある", () => {
    for (const d of MERCHANT_TERMS_DOCUMENTS) {
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.url).toMatch(/^https:\/\//);
    }
  });
});

describe("buildTermsAgreementRecord", () => {
  it("同意日時と、その時点の規約一覧を記録する", () => {
    const r = buildTermsAgreementRecord("2026-08-27T05:12:33.000Z");
    expect(r.agreed).toBe(true);
    expect(r.agreedAt).toBe("2026-08-27T05:12:33.000Z");
    expect(r.documents).toHaveLength(MERCHANT_TERMS_DOCUMENTS.length);
    expect(r.documents[0].url).toBe(MERCHANT_TERMS_DOCUMENTS[0].url);
  });

  it("規約一覧はコピーを持つ（記録が後の変更に引きずられない）", () => {
    const r = buildTermsAgreementRecord("2026-08-27T05:12:33.000Z");
    expect(r.documents).not.toBe(MERCHANT_TERMS_DOCUMENTS);
  });
});

describe("formatTermsAgreement", () => {
  it("日時と規約名を1行に整形する", () => {
    const s = formatTermsAgreement(
      buildTermsAgreementRecord(new Date(2026, 7, 27, 14, 5).toISOString())
    );
    expect(s).toContain("2026/08/27 14:05");
    expect(s).toContain("クレディセゾン加盟店規約");
    expect(s).toContain("JCB加盟店規約");
  });

  it("記録が無い・壊れている場合は null（区分導入前の申請など）", () => {
    expect(formatTermsAgreement(undefined)).toBeNull();
    expect(formatTermsAgreement(null)).toBeNull();
    expect(formatTermsAgreement({})).toBeNull();
    expect(formatTermsAgreement({ agreed: false, agreedAt: "2026-08-27T00:00:00Z" })).toBeNull();
    expect(formatTermsAgreement({ agreed: true, agreedAt: "not-a-date" })).toBeNull();
  });
});
