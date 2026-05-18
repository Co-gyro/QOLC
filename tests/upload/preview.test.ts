import { describe, it, expect } from "vitest";
import {
  groupForPreview,
  type PreviewLine,
} from "../../src/lib/upload/preview";

function line(p: Partial<PreviewLine>): PreviewLine {
  return {
    statementLineId: "l",
    facilityId: null,
    residentId: null,
    residentName: null,
    insuranceNumber: "",
    serviceCode: null,
    serviceName: null,
    amount: 0,
    selfPayAmount: 0,
    matchStatus: "unmatched",
    ...p,
  };
}

describe("groupForPreview", () => {
  const meta = {
    facilityNames: new Map([
      ["f1", "〇〇介護施設"],
      ["f2", "△△ケアホーム"],
    ]),
    residentNames: new Map([
      ["r1", "田中太郎"],
      ["r2", "鈴木花子"],
      ["r3", "佐藤次郎"],
    ]),
  };

  it("空配列は空のプレビュー", () => {
    const r = groupForPreview("b1", [], meta);
    expect(r.batchId).toBe("b1");
    expect(r.facilities).toEqual([]);
    expect(r.unmatched).toEqual([]);
    expect(r.totalAmount).toBe(0);
  });

  it("施設別→入居者別にグルーピングし金額合計を出す", () => {
    const lines: PreviewLine[] = [
      line({ statementLineId: "l1", facilityId: "f1", residentId: "r1", insuranceNumber: "1", amount: 5000, selfPayAmount: 500, matchStatus: "matched" }),
      line({ statementLineId: "l2", facilityId: "f1", residentId: "r2", insuranceNumber: "2", amount: 3000, selfPayAmount: 300, matchStatus: "matched" }),
      line({ statementLineId: "l3", facilityId: "f1", residentId: "r1", insuranceNumber: "1", amount: 2000, selfPayAmount: 200, matchStatus: "matched" }),
      line({ statementLineId: "l4", facilityId: "f2", residentId: "r3", insuranceNumber: "3", amount: 8000, selfPayAmount: 800, matchStatus: "matched" }),
    ];
    const r = groupForPreview("b1", lines, meta);
    expect(r.facilities).toHaveLength(2);

    const f1 = r.facilities.find((f) => f.facilityId === "f1")!;
    expect(f1.facilityName).toBe("〇〇介護施設");
    expect(f1.residents).toHaveLength(2);
    const r1 = f1.residents.find((x) => x.residentId === "r1")!;
    expect(r1.totalAmount).toBe(7000);
    expect(r1.lines).toHaveLength(2);

    const f2 = r.facilities.find((f) => f.facilityId === "f2")!;
    expect(f2.totalAmount).toBe(8000);

    expect(r.totalAmount).toBe(18000);
  });

  it("matchStatus が unmatched なら施設の unmatched に入る", () => {
    const lines: PreviewLine[] = [
      line({ statementLineId: "l1", facilityId: "f1", residentId: null, insuranceNumber: "999", amount: 1000, matchStatus: "unmatched" }),
    ];
    const r = groupForPreview("b1", lines, meta);
    expect(r.facilities[0].unmatched).toHaveLength(1);
  });

  it("facility_id が null の行はトップレベルの unmatched", () => {
    const lines: PreviewLine[] = [
      line({ statementLineId: "l1", facilityId: null, residentId: null, insuranceNumber: "???", amount: 6000, matchStatus: "unmatched" }),
    ];
    const r = groupForPreview("b1", lines, meta);
    expect(r.facilities).toHaveLength(0);
    expect(r.unmatched).toHaveLength(1);
    expect(r.totalAmount).toBe(6000);
  });
});
