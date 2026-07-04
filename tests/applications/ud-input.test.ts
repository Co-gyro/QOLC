import { describe, expect, it } from "vitest";

import {
  DEFAULT_BULK_PROVIDER_CODE,
  UD_INPUT_FIELD_KEYS,
  UD_INPUT_LABELS,
  describeUdFieldChanges,
  mergeCompanyReview,
  parseUdInput,
  serializeUdInput,
  summarizeReview,
  type ApplicationReview,
} from "@/lib/applications/ud-input";

describe("parseUdInput", () => {
  it("null / undefined は空のフィールド・審査記録を返す", () => {
    expect(parseUdInput(null)).toEqual({ fields: {}, review: {} });
    expect(parseUdInput(undefined)).toEqual({ fields: {}, review: {} });
  });

  it("既知フィールドのみ取り込み、未知キーと空文字は無視する", () => {
    const { fields } = parseUdInput({
      bulk_provider_code: "0160",
      settlement_rate: "1.9",
      unknown_key: "x",
      bank_name: "",
    });
    expect(fields.bulk_provider_code).toBe("0160");
    expect(fields.settlement_rate).toBe("1.9");
    expect(fields.bank_name).toBeUndefined();
    expect("unknown_key" in fields).toBe(false);
  });

  it("account_type は ordinary / checking 以外を捨てる", () => {
    expect(parseUdInput({ account_type: "ordinary" }).fields.account_type).toBe("ordinary");
    expect(parseUdInput({ account_type: "invalid" }).fields.account_type).toBeUndefined();
  });

  it("review の JCB 2種番号・セゾン番号・結果を読み取る", () => {
    const { review } = parseUdInput({
      review: {
        jcb: {
          submitted_at: "2026-07-01",
          result: "approved",
          merchant_code_recurring: "111",
          merchant_code_ec: "222",
        },
        saison: { result: "rejected", ng_reason: "書類不備", merchant_code: "2077247" },
      },
    });
    expect(review.jcb?.result).toBe("approved");
    expect(review.jcb?.merchant_code_recurring).toBe("111");
    expect(review.jcb?.merchant_code_ec).toBe("222");
    expect(review.saison?.result).toBe("rejected");
    expect(review.saison?.merchant_code).toBe("2077247");
  });

  it("不正な result は null に正規化する", () => {
    const { review } = parseUdInput({ review: { jcb: { result: "maybe" } } });
    expect(review.jcb?.result).toBeNull();
  });
});

describe("serializeUdInput", () => {
  it("空文字フィールドを除去し、review を保持する", () => {
    const review: ApplicationReview = { jcb: { result: "approved" } };
    const out = serializeUdInput({ bank_name: " みずほ ", bank_branch: "" }, review);
    expect(out.bank_name).toBe("みずほ");
    expect("bank_branch" in out).toBe(false);
    expect((out.review as Record<string, unknown>).jcb).toEqual({ result: "approved" });
  });

  it("review が空なら review キー自体を含めない", () => {
    expect("review" in serializeUdInput({ settlement_rate: "1.9" }, {})).toBe(false);
  });

  it("parse → serialize → parse で値が保たれる（往復整合）", () => {
    const original = {
      bulk_provider_code: DEFAULT_BULK_PROVIDER_CODE,
      account_type: "checking",
      review: { saison: { result: "approved", merchant_code: "1234567" } },
    };
    const p1 = parseUdInput(original);
    const p2 = parseUdInput(serializeUdInput(p1.fields, p1.review));
    expect(p2.fields).toEqual(p1.fields);
    expect(p2.review).toEqual(p1.review);
  });
});

describe("mergeCompanyReview / summarizeReview", () => {
  it("1社分のみ差し替え、他社分は保持する", () => {
    const before: ApplicationReview = { jcb: { result: "approved" } };
    const after = mergeCompanyReview(before, "saison", { result: "rejected" });
    expect(after.jcb?.result).toBe("approved");
    expect(after.saison?.result).toBe("rejected");
  });

  it("承認状況サマリ（any / all / rejected）を正しく判定する", () => {
    expect(summarizeReview({})).toEqual({
      jcbApproved: false,
      saisonApproved: false,
      anyApproved: false,
      allApproved: false,
      anyRejected: false,
    });
    const partial = summarizeReview({ jcb: { result: "approved" } });
    expect(partial.anyApproved).toBe(true);
    expect(partial.allApproved).toBe(false);
    const both = summarizeReview({
      jcb: { result: "approved" },
      saison: { result: "approved" },
    });
    expect(both.allApproved).toBe(true);
    expect(summarizeReview({ saison: { result: "rejected" } }).anyRejected).toBe(true);
  });
});

describe("describeUdFieldChanges", () => {
  it("変更のあったフィールドの日本語ラベルを返す", () => {
    const changed = describeUdFieldChanges(
      { settlement_rate: "1.9" },
      { settlement_rate: "2.5", bank_name: "みずほ" }
    );
    expect(changed).toEqual(["精算料率", "振込先銀行名"]);
  });

  it("変更がなければ空配列", () => {
    expect(describeUdFieldChanges({ bank_name: "A" }, { bank_name: "A" })).toEqual([]);
  });

  it("全フィールドキーにラベルが定義されている", () => {
    for (const key of UD_INPUT_FIELD_KEYS) {
      expect(UD_INPUT_LABELS[key]).toBeTruthy();
    }
  });
});
