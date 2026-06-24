import { describe, it, expect } from "vitest";

import { isLinePushEligible } from "@/lib/notifications/notify";
import { formatYen, buildPaymentCompletedMessage } from "@/lib/notifications/payment-notify";

describe("isLinePushEligible", () => {
  const base = { notificationMethod: "line", lineFollowState: "followed", lineUserId: "U1" };

  it("line + followed + userId → 対象", () => {
    expect(isLinePushEligible(base)).toBe(true);
  });
  it("unknown でも（ブロックでなければ）対象", () => {
    expect(isLinePushEligible({ ...base, lineFollowState: "unknown" })).toBe(true);
  });
  it("ブロック中は対象外", () => {
    expect(isLinePushEligible({ ...base, lineFollowState: "blocked" })).toBe(false);
  });
  it("method=email は対象外", () => {
    expect(isLinePushEligible({ ...base, notificationMethod: "email" })).toBe(false);
  });
  it("line_user_id なしは対象外", () => {
    expect(isLinePushEligible({ ...base, lineUserId: null })).toBe(false);
  });
});

describe("formatYen", () => {
  it("3桁区切り + 円", () => {
    expect(formatYen(1200)).toBe("1,200円");
    expect(formatYen(0)).toBe("0円");
    expect(formatYen(1234567)).toBe("1,234,567円");
  });
});

describe("buildPaymentCompletedMessage", () => {
  it("金額のみ", () => {
    const m = buildPaymentCompletedMessage(1200);
    expect(m.title).toBe("お支払いが完了しました");
    expect(m.body).toContain("1,200円");
    expect(m.body).not.toContain("ご利用先");
  });
  it("加盟店名あり", () => {
    const m = buildPaymentCompletedMessage(1200, "テスト薬局");
    expect(m.body).toContain("ご利用先: テスト薬局");
  });
});
