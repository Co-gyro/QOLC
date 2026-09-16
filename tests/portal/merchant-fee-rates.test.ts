import { describe, it, expect } from "vitest";
import {
  summarizeFeeRates,
  formatFeeRates,
  groupFeeRatesByMerchant,
} from "@/lib/portal/merchant-fee-rates";

describe("summarizeFeeRates（ud_input → 一覧用の料率）", () => {
  it("精算料率とブランド別カード会社手数料率を取り出す", () => {
    expect(
      summarizeFeeRates({
        settlement_rate: "1.9",
        card_company_fee_rate_jcb: "3.0",
        card_company_fee_rate_saison: "3.2",
      })
    ).toEqual({ settlement: "1.9", jcb: "3.0", saison: "3.2", legacy: null });
  });

  it("未入力は null、旧・共通欄は legacy に分けて持つ", () => {
    expect(summarizeFeeRates({ card_company_fee_rate: "2.5" })).toEqual({
      settlement: null,
      jcb: null,
      saison: null,
      legacy: "2.5",
    });
    expect(summarizeFeeRates(null)).toEqual({ settlement: null, jcb: null, saison: null, legacy: null });
  });
});

describe("formatFeeRates（一覧の短い表記）", () => {
  it("入力済みは % 付き、未入力は —、旧共通は明示", () => {
    expect(formatFeeRates({ settlement: "1.9", jcb: "3.0", saison: null, legacy: null })).toBe(
      "精算 1.9% / JCB 3.0% / セゾン —"
    );
    expect(formatFeeRates({ settlement: null, jcb: null, saison: null, legacy: "2.5" })).toBe(
      "精算 — / JCB 2.5%（旧共通） / セゾン 2.5%（旧共通）"
    );
    expect(formatFeeRates(null)).toBe("—");
  });
});

describe("groupFeeRatesByMerchant（merchant_id ごとに最新の申請を採用）", () => {
  it("同じ加盟店に複数の申請があれば created_at が新しい方を使う", () => {
    const map = groupFeeRatesByMerchant([
      { merchant_id: "m1", ud_input: { settlement_rate: "1.0" }, created_at: "2026-01-01T00:00:00Z" },
      { merchant_id: "m1", ud_input: { settlement_rate: "1.9" }, created_at: "2026-06-01T00:00:00Z" },
      { merchant_id: null, ud_input: { settlement_rate: "9.9" }, created_at: "2026-07-01T00:00:00Z" },
      { merchant_id: "m2", ud_input: null, created_at: "2026-02-01T00:00:00Z" },
    ]);
    expect(map.get("m1")?.settlement).toBe("1.9");
    expect(map.get("m2")).toEqual({ settlement: null, jcb: null, saison: null, legacy: null });
    expect(map.size).toBe(2);
  });
});
