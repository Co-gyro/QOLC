import { describe, expect, it } from "vitest";

import {
  buildMerchantApplicationUpsert,
  buildMerchantInsert,
  pickMerchantApplyPayload,
  validateConvertPreconditions,
} from "@/lib/applications/convert";
import type { ApplicationReview } from "@/lib/applications/ud-input";

const APPROVED_BOTH: ApplicationReview = {
  jcb: {
    submitted_at: "2026-07-01",
    result: "approved",
    result_received_at: "2026-07-10",
    merchant_code_recurring: "12345678901234567",
    merchant_code_ec: "76543210987654321",
  },
  saison: {
    submitted_at: "2026-07-02",
    result: "approved",
    result_received_at: "2026-07-12",
    merchant_code: "2077247",
  },
};

describe("pickMerchantApplyPayload", () => {
  it("payload から必要キーのみ trim して取り出す", () => {
    const picked = pickMerchantApplyPayload({
      corpName: " ユニバーサルデベロップメント株式会社 ",
      facilityName: "介護施設A",
      facilityAddress: "東京都港区1-2-3",
      facilityPhone: "03-1234-5678",
      note: "使わないキー",
    });
    expect(picked.corpName).toBe("ユニバーサルデベロップメント株式会社");
    expect(picked.facilityName).toBe("介護施設A");
    expect("note" in picked).toBe(false);
  });

  it("null payload でも空オブジェクトで返す", () => {
    expect(pickMerchantApplyPayload(null)).toEqual({
      corpName: undefined,
      facilityName: undefined,
      facilityAddress: undefined,
      facilityPhone: undefined,
      address: undefined,
      phone: undefined,
    });
  });
});

describe("buildMerchantInsert", () => {
  it("施設名を加盟店名とし、審査結果の番号（JCB2種+セゾン）を転記する", () => {
    const row = buildMerchantInsert(
      {
        corpName: "UD株式会社",
        facilityName: "介護施設A",
        facilityAddress: "東京都港区1-2-3",
        facilityPhone: "03-1234-5678",
      },
      APPROVED_BOTH
    );
    expect(row.name).toBe("介護施設A");
    expect(row.address).toBe("東京都港区1-2-3");
    expect(row.jcb_merchant_code_recurring).toBe("12345678901234567");
    expect(row.jcb_merchant_code_ec).toBe("76543210987654321");
    expect(row.saison_merchant_code).toBe("2077247");
  });

  it("施設名がなければ法人名で補完する", () => {
    const row = buildMerchantInsert({ corpName: "UD株式会社" }, {});
    expect(row.name).toBe("UD株式会社");
    expect(row.jcb_merchant_code_recurring).toBeNull();
  });

  it("施設名も法人名もなければ throw する", () => {
    expect(() => buildMerchantInsert({}, {})).toThrow(/加盟店名を決定できません/);
  });
});

describe("buildMerchantApplicationUpsert", () => {
  it("両社通過なら status=approved / result=approved、提出日は最小・受領日は最大", () => {
    const row = buildMerchantApplicationUpsert(APPROVED_BOTH, "m-1", "a-1");
    expect(row.merchant_id).toBe("m-1");
    expect(row.application_id).toBe("a-1");
    expect(row.status).toBe("approved");
    expect(row.result).toBe("approved");
    expect(row.submitted_at).toBe("2026-07-01");
    expect(row.result_received_at).toBe("2026-07-12");
    expect(row.ng_reason).toBeNull();
    expect(JSON.parse(row.notes ?? "{}").saison.merchant_code).toBe("2077247");
  });

  it("片方 NG なら status=rejected と会社名つき NG 理由", () => {
    const row = buildMerchantApplicationUpsert(
      {
        jcb: { result: "approved", submitted_at: "2026-07-01" },
        saison: { result: "rejected", ng_reason: "書類不備" },
      },
      "m-1",
      "a-1"
    );
    expect(row.status).toBe("rejected");
    expect(row.result).toBe("rejected");
    expect(row.ng_reason).toBe("セゾン: 書類不備");
  });

  it("提出済み・結果待ちは status=reviewing / result=null", () => {
    const row = buildMerchantApplicationUpsert(
      { jcb: { submitted_at: "2026-07-01" } },
      "m-1",
      "a-1"
    );
    expect(row.status).toBe("reviewing");
    expect(row.result).toBeNull();
  });

  it("未提出は status=pending", () => {
    expect(buildMerchantApplicationUpsert({}, "m-1", "a-1").status).toBe("pending");
  });
});

describe("validateConvertPreconditions", () => {
  it("変換済み（merchant_id あり）は不可", () => {
    expect(
      validateConvertPreconditions({ merchantId: "m-1", review: APPROVED_BOTH, fields: {} })
    ).toMatch(/変換済み/);
  });

  it("どちらも未通過は不可", () => {
    expect(
      validateConvertPreconditions({ merchantId: null, review: {}, fields: {} })
    ).toMatch(/審査通過前/);
  });

  it("1社でも通過していれば可（null を返す）", () => {
    expect(
      validateConvertPreconditions({
        merchantId: null,
        review: { jcb: { result: "approved" } },
        fields: {},
      })
    ).toBeNull();
  });
});
