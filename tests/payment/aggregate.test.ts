/**
 * payment-service の集約ロジック単体テスト
 */
import { describe, it, expect } from "vitest";
import { aggregateByResidentMerchant } from "../../src/lib/payment/payment-service";

describe("aggregateByResidentMerchant", () => {
  const M = "merchant-1";

  it("空配列は空配列", () => {
    expect(aggregateByResidentMerchant([], M)).toEqual([]);
  });

  it("同一入居者の複数明細は合算される", () => {
    const lines = [
      { id: "l1", resident_id: "r1", facility_id: "f1", self_pay_amount: 1000, amount: 5000 },
      { id: "l2", resident_id: "r1", facility_id: "f1", self_pay_amount: 2000, amount: 8000 },
      { id: "l3", resident_id: "r1", facility_id: "f1", self_pay_amount: 500, amount: 1500 },
    ];
    const result = aggregateByResidentMerchant(lines, M);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      residentId: "r1",
      merchantId: M,
      totalAmount: 3500,
    });
    expect(result[0].statementLineIds).toEqual(["l1", "l2", "l3"]);
  });

  it("異なる入居者は別グループ", () => {
    const lines = [
      { id: "l1", resident_id: "r1", facility_id: "f1", self_pay_amount: 1000, amount: 5000 },
      { id: "l2", resident_id: "r2", facility_id: "f1", self_pay_amount: 2000, amount: 8000 },
      { id: "l3", resident_id: "r3", facility_id: "f2", self_pay_amount: 3000, amount: 12000 },
    ];
    const result = aggregateByResidentMerchant(lines, M);
    expect(result).toHaveLength(3);
    expect(result.map((g) => g.totalAmount).sort()).toEqual([1000, 2000, 3000]);
  });

  it("resident_id が null の明細はスキップ", () => {
    const lines = [
      { id: "l1", resident_id: "r1", facility_id: "f1", self_pay_amount: 1000, amount: 5000 },
      { id: "l2", resident_id: null, facility_id: "f1", self_pay_amount: 2000, amount: 8000 },
    ];
    const result = aggregateByResidentMerchant(lines, M);
    expect(result).toHaveLength(1);
    expect(result[0].residentId).toBe("r1");
    expect(result[0].totalAmount).toBe(1000);
  });

  it("self_pay_amount が null なら amount にフォールバック", () => {
    const lines = [
      { id: "l1", resident_id: "r1", facility_id: "f1", self_pay_amount: null, amount: 5000 },
    ];
    const result = aggregateByResidentMerchant(lines, M);
    expect(result[0].totalAmount).toBe(5000);
  });

  it("どちらも null なら 0", () => {
    const lines = [
      { id: "l1", resident_id: "r1", facility_id: "f1", self_pay_amount: null, amount: null },
    ];
    const result = aggregateByResidentMerchant(lines, M);
    expect(result[0].totalAmount).toBe(0);
  });
});
