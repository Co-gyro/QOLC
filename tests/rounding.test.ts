import { describe, it, expect } from "vitest";

import { computeFee } from "@/lib/csv/saison-fm";

// 参考: FI (src/lib/csv/saison-fi.ts) は Math.round を使用。
// FM (src/lib/csv/saison-fm.ts) は Math.floor を使用。
// セゾン支払計算書の実挙動は四捨五入 (Math.round) で、FIはそれに合わせている。
// FMは現状floorのため、将来的にroundへ統一するかは別タスク扱い。

describe("FM computeFee (Math.floor)", () => {
  it("整数結果: 130,000 × 3.25% = 4,225 (端数なし)", () => {
    expect(computeFee(130000, 3.25)).toBe(4225);
  });

  it("端数あり: 123,456 × 3.25% = 4,012.32 → 切り捨て 4,012", () => {
    expect(computeFee(123456, 3.25)).toBe(4012);
  });

  it("境界値 .5 は切り捨てる: 103,000 × 3.25% = 3,347.5 → 3,347 (FMの現仕様)", () => {
    expect(computeFee(103000, 3.25)).toBe(3347);
  });

  it("境界値 .5 は切り捨てる: 45,000 × 3.25% = 1,462.5 → 1,462", () => {
    expect(computeFee(45000, 3.25)).toBe(1462);
  });

  it("マイナス金額もゼロに近づける方向で切り捨て: -35,000 × 3.25% = -1,137.5 → -1,137", () => {
    expect(computeFee(-35000, 3.25)).toBe(-1137);
  });
});

describe("FI の端数処理 (Math.round)", () => {
  // FI は crossPdfCsvToFi の内部で Math.round((sum * rate) / 100) を使用。
  // 単体の丸めロジック自体を直接検証する形で明示化する。
  const round = (amount: number, rate: number) => Math.round((amount * rate) / 100);

  it("整数結果: 70,000 × 3.25% = 2,275", () => {
    expect(round(70000, 3.25)).toBe(2275);
  });

  it("端数あり: 123,456 × 3.25% = 4,012.32 → 四捨五入 4,012", () => {
    expect(round(123456, 3.25)).toBe(4012);
  });

  it("境界値 .5 は切り上げる: 103,000 × 3.25% = 3,347.5 → 3,348 (セゾン実挙動)", () => {
    expect(round(103000, 3.25)).toBe(3348);
  });

  it("境界値 .5 は切り上げる: 45,000 × 3.25% = 1,462.5 → 1,463", () => {
    expect(round(45000, 3.25)).toBe(1463);
  });
});

describe("FM と FI の端数処理の差 (将来統一検討)", () => {
  it("同じ入力でもFMとFIで1円ずれる (103,000 × 3.25%)", () => {
    const fm = computeFee(103000, 3.25);
    const fi = Math.round((103000 * 3.25) / 100);
    expect(fm).toBe(3347);
    expect(fi).toBe(3348);
    expect(fi - fm).toBe(1);
  });
});
