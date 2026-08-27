/**
 * 加盟店申請の申請区分（src/lib/applications/apply-type.ts）のテスト。
 *
 * 介護以外のお客様向け入口では「介護」「施設」という語を出さないこと、
 * 区分未指定の既存申請が介護施設向けとして扱われることを固定する。
 */
import { describe, it, expect } from "vitest";
import {
  APPLY_TYPE_COPY,
  DEFAULT_APPLY_TYPE,
  MERCHANT_APPLY_TYPES,
  applySiteLabels,
  applyTypeOfPayload,
  isApplyType,
  parseApplyType,
} from "../../src/lib/applications/apply-type";
import { merchantApplyFormSchema } from "../../src/lib/applications/schema";

describe("parseApplyType / isApplyType", () => {
  it("care / general を受け付ける", () => {
    expect(parseApplyType("care")).toBe("care");
    expect(parseApplyType("general")).toBe("general");
    expect(isApplyType("care")).toBe(true);
    expect(isApplyType("general")).toBe(true);
  });

  it("不正値・未指定は既定（care）になる", () => {
    expect(parseApplyType(undefined)).toBe(DEFAULT_APPLY_TYPE);
    expect(parseApplyType("")).toBe("care");
    expect(parseApplyType("CARE")).toBe("care");
    expect(parseApplyType(123)).toBe("care");
    expect(isApplyType(undefined)).toBe(false);
    expect(isApplyType("CARE")).toBe(false);
  });
});

describe("applyTypeOfPayload", () => {
  it("payload.applyType を読む", () => {
    expect(applyTypeOfPayload({ applyType: "general" })).toBe("general");
  });

  it("区分導入前の申請（applyType なし）は介護施設向け扱い", () => {
    expect(applyTypeOfPayload({ corpName: "株式会社サンプル" })).toBe("care");
    expect(applyTypeOfPayload(null)).toBe("care");
    expect(applyTypeOfPayload(undefined)).toBe("care");
  });
});

describe("applySiteLabels", () => {
  it("介護施設向けは「施設」表記", () => {
    const l = applySiteLabels("care");
    expect(l.section).toBe("施設情報");
    expect(l.name).toBe("施設名");
    expect(l.nameKana).toBe("施設名フリガナ");
    expect(l.postalCode).toBe("施設 郵便番号");
    expect(l.address).toBe("施設 所在地");
    expect(l.phone).toBe("施設 電話番号");
  });

  it("一般向けは「店舗・事業所」表記で、施設という語を含まない", () => {
    const l = applySiteLabels("general");
    expect(l.section).toBe("店舗・事業所情報");
    expect(l.name).toBe("店舗・事業所名");
    for (const v of Object.values(l)) {
      expect(v).not.toContain("施設");
    }
  });
});

describe("APPLY_TYPE_COPY", () => {
  it("全区分の文言が定義されている", () => {
    for (const key of MERCHANT_APPLY_TYPES) {
      expect(APPLY_TYPE_COPY[key].key).toBe(key);
      expect(APPLY_TYPE_COPY[key].badge.length).toBeGreaterThan(0);
    }
  });

  it("一般向けの文言には「介護」「施設」が一切出てこない", () => {
    const c = APPLY_TYPE_COPY.general;
    const text = [
      c.heroLead,
      c.siteNoun,
      c.siteNamePlaceholder,
      c.siteNameKanaPlaceholder,
      c.corpNamePlaceholder,
      c.corpNameKanaPlaceholder,
      c.notePlaceholder,
      c.badge,
    ].join(" ");
    expect(text).not.toContain("介護");
    expect(text).not.toContain("施設");
    // QOLC ブランド名も本文からは出さない（介護以外のお客様向けのため）
    expect(text).not.toContain("QOLC");
  });
});

describe("merchantApplyFormSchema と applyType", () => {
  /** 検証を通す最小の有効入力 */
  const valid = {
    corpType: "法人" as const,
    corpName: "株式会社サンプル",
    corpNameKana: "カブシキガイシャサンプル",
    corporateNumber: "1234567890123",
    postalCode: "123-4567",
    address: "東京都千代田区丸の内1-1-1",
    phone: "03-1234-5678",
    repLastName: "山田",
    repFirstName: "太郎",
    repLastNameKana: "ヤマダ",
    repFirstNameKana: "タロウ",
    repBirthdate: "1980-01-01",
    facilityName: "サンプルストア東京店",
    facilityNameKana: "サンプルストアトウキョウテン",
    facilityPostalCode: "123-4567",
    facilityAddress: "東京都千代田区丸の内1-1-1",
    facilityPhone: "03-1234-5678",
    contactLastName: "佐藤",
    contactFirstName: "花子",
    contactEmail: "sample@example.com",
    contactPhone: "090-1234-5678",
    contactTime: "いつでも" as const,
  };

  it("applyType=general を保持したまま検証を通す", () => {
    const r = merchantApplyFormSchema.safeParse({ ...valid, applyType: "general" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.applyType).toBe("general");
  });

  it("applyType なしでも通る（区分導入前の payload 互換）", () => {
    expect(merchantApplyFormSchema.safeParse(valid).success).toBe(true);
  });

  it("不正な applyType は弾く", () => {
    expect(
      merchantApplyFormSchema.safeParse({ ...valid, applyType: "restaurant" }).success
    ).toBe(false);
  });
});
