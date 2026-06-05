/**
 * レセプトと入居者のマッチングロジックのユニットテスト
 */
import { describe, it, expect } from "vitest";
import {
  matchKaigoReceipts,
  matchIryouReceipts,
  summarizeKaigoMatches,
  summarizeIryouMatches,
  type ResidentForMatching,
} from "../../src/lib/receipt/matcher";
import type { KaigoReceiptResident } from "../../src/lib/receipt/kaigo-csv";
import type { IryouReceiptPatient } from "../../src/lib/receipt/iryou-uke";

function buildResident(overrides: Partial<ResidentForMatching>): ResidentForMatching {
  return {
    id: "r1",
    nameLast: "山田",
    nameFirst: "太郎",
    insuranceNumber: null,
    iryouHokenshaBangou: null,
    iryouHihokenshaKigou: null,
    iryouHihokenshaBangou: null,
    iryouHihokenshaEdaban: null,
    formerInsuranceNumbers: [],
    ...overrides,
  };
}

function buildKaigoReceipt(overrides: Partial<KaigoReceiptResident>): KaigoReceiptResident {
  return {
    insuranceNumber: "0001234567",
    insurerNumber: "102012",
    serviceMonth: "202604",
    birthDate: "",
    gender: "",
    benefitRatePercent: 90,
    totalUnits: 0,
    insuranceClaim: 100000,
    userBurden: 10000,
    ...overrides,
  };
}

function buildIryouReceipt(
  overrides: Partial<IryouReceiptPatient> & {
    hokenshaNumber?: string;
    kigou?: string;
    bangou?: string;
    burdenAmount?: number;
  }
): IryouReceiptPatient {
  const {
    hokenshaNumber = "100016",
    kigou = "ま",
    bangou = "717-6128",
    burdenAmount = 10000,
    ...rest
  } = overrides;
  return {
    seq: 1,
    receiptType: "6122",
    serviceMonth: "202604",
    name: "古谷　敏雄",
    nameKana: "",
    gender: "1",
    birthDate: "",
    receiptNumber: "",
    hoken: {
      hokenshaNumber,
      kigou,
      bangou,
      actualDays: 0,
      totalAmount: 0,
      userBurden: burdenAmount,
    },
    kofu: [],
    userBurden: burdenAmount,
    ...rest,
  };
}

describe("matchKaigoReceipts", () => {
  it("現番号で一致する入居者にマッチする", () => {
    const residents = [buildResident({ insuranceNumber: "0001234567" })];
    const receipts = [buildKaigoReceipt({ insuranceNumber: "0001234567" })];
    const results = matchKaigoReceipts(receipts, residents);
    expect(results[0].status).toBe("matched");
    expect(results[0].resident?.id).toBe("r1");
  });

  it("現番号も過去番号もマッチしない場合は unmatched", () => {
    const residents = [buildResident({ insuranceNumber: "0009999999" })];
    const receipts = [buildKaigoReceipt({ insuranceNumber: "0001234567" })];
    const results = matchKaigoReceipts(receipts, residents);
    expect(results[0].status).toBe("unmatched");
    expect(results[0].resident).toBeNull();
  });

  it("過去番号(kaigo)でサービス月が有効期限内なら matched_via_history", () => {
    const residents = [
      buildResident({
        insuranceNumber: "0009999999", // 現在は別の番号
        formerInsuranceNumbers: [
          { type: "kaigo", bangou: "0001234567", valid_until: "2026-04-30" },
        ],
      }),
    ];
    const receipts = [buildKaigoReceipt({ insuranceNumber: "0001234567", serviceMonth: "202604" })];
    const results = matchKaigoReceipts(receipts, residents);
    expect(results[0].status).toBe("matched_via_history");
    expect(results[0].matchedHistory?.bangou).toBe("0001234567");
  });

  it("過去番号があってもサービス月が有効期限切れなら unmatched", () => {
    const residents = [
      buildResident({
        insuranceNumber: "0009999999",
        formerInsuranceNumbers: [
          { type: "kaigo", bangou: "0001234567", valid_until: "2026-03-31" },
        ],
      }),
    ];
    const receipts = [buildKaigoReceipt({ insuranceNumber: "0001234567", serviceMonth: "202604" })];
    const results = matchKaigoReceipts(receipts, residents);
    expect(results[0].status).toBe("unmatched");
  });

  it("type='iryou'の過去番号は kaigoマッチング対象外", () => {
    const residents = [
      buildResident({
        formerInsuranceNumbers: [
          { type: "iryou", bangou: "0001234567", valid_until: null },
        ],
      }),
    ];
    const receipts = [buildKaigoReceipt({ insuranceNumber: "0001234567" })];
    const results = matchKaigoReceipts(receipts, residents);
    expect(results[0].status).toBe("unmatched");
  });
});

describe("matchIryouReceipts", () => {
  it("保険者番号+記号+被保険者番号の3項目一致で matched", () => {
    const residents = [
      buildResident({
        iryouHokenshaBangou: "100016",
        iryouHihokenshaKigou: "ま",
        iryouHihokenshaBangou: "717-6128",
      }),
    ];
    const receipts = [buildIryouReceipt({})];
    const results = matchIryouReceipts(receipts, residents);
    expect(results[0].status).toBe("matched");
  });

  it("保険者番号が違うと unmatched", () => {
    const residents = [
      buildResident({
        iryouHokenshaBangou: "999999",
        iryouHihokenshaKigou: "ま",
        iryouHihokenshaBangou: "717-6128",
      }),
    ];
    const receipts = [buildIryouReceipt({ hokenshaNumber: "100016" })];
    const results = matchIryouReceipts(receipts, residents);
    expect(results[0].status).toBe("unmatched");
  });

  it("記号がNULL同士の場合もマッチする（記号なし保険者対応）", () => {
    const residents = [
      buildResident({
        iryouHokenshaBangou: "39102017",
        iryouHihokenshaKigou: null,
        iryouHihokenshaBangou: "7458102",
      }),
    ];
    const receipts = [
      buildIryouReceipt({ hokenshaNumber: "39102017", kigou: "", bangou: "7458102" }),
    ];
    const results = matchIryouReceipts(receipts, residents);
    expect(results[0].status).toBe("matched");
  });

  it("HOがない患者(支払基金型)は unmatched", () => {
    const residents = [buildResident({ iryouHokenshaBangou: "100016" })];
    const receipts = [buildIryouReceipt({})];
    receipts[0].hoken = null;
    const results = matchIryouReceipts(receipts, residents);
    expect(results[0].status).toBe("unmatched");
  });

  it("過去番号(iryou)でサービス月が有効期限内なら matched_via_history", () => {
    const residents = [
      buildResident({
        iryouHokenshaBangou: "999999",
        formerInsuranceNumbers: [
          {
            type: "iryou",
            hokensha_bangou: "100016",
            kigou: "ま",
            bangou: "717-6128",
            valid_until: "2026-04-30",
          },
        ],
      }),
    ];
    const receipts = [buildIryouReceipt({})];
    const results = matchIryouReceipts(receipts, residents);
    expect(results[0].status).toBe("matched_via_history");
  });
});

describe("summarize", () => {
  it("件数と金額を正しく集計する", () => {
    const residents = [
      buildResident({ id: "r1", insuranceNumber: "0001234567" }),
    ];
    const receipts = [
      buildKaigoReceipt({ insuranceNumber: "0001234567", userBurden: 10000 }),
      buildKaigoReceipt({ insuranceNumber: "0009999999", userBurden: 8000 }), // unmatched
      buildKaigoReceipt({ insuranceNumber: "0001234567", userBurden: 0 }), // matched but 0 burden
    ];
    const results = matchKaigoReceipts(receipts, residents);
    const summary = summarizeKaigoMatches(results);
    expect(summary.total).toBe(3);
    expect(summary.matched).toBe(2);
    expect(summary.unmatched).toBe(1);
    expect(summary.totalChargeableAmount).toBe(10000);
    expect(summary.zeroBurdenCount).toBe(1);
  });

  it("iryou も同様に集計できる", () => {
    const residents = [
      buildResident({
        iryouHokenshaBangou: "100016",
        iryouHihokenshaKigou: "ま",
        iryouHihokenshaBangou: "717-6128",
      }),
    ];
    const receipts = [buildIryouReceipt({ burdenAmount: 10000 })];
    const results = matchIryouReceipts(receipts, residents);
    const summary = summarizeIryouMatches(results);
    expect(summary.total).toBe(1);
    expect(summary.matched).toBe(1);
    expect(summary.totalChargeableAmount).toBe(10000);
  });
});
