import { describe, expect, it } from "vitest";
import {
  cardExpiryStatus,
  formatExpireYm,
  isExpiryNoticeDay,
  isValidExpireYm,
  toExpireYm,
} from "@/lib/payment/card-expiry";

describe("toExpireYm", () => {
  it("USEN の年・月から YYYYMM を作る（月は0埋め）", () => {
    expect(toExpireYm("2028", "3")).toBe("202803");
    expect(toExpireYm("2028", "12")).toBe("202812");
  });
  it("欠損・不正値は null", () => {
    expect(toExpireYm(undefined, "03")).toBeNull();
    expect(toExpireYm("2028", "13")).toBeNull();
    expect(toExpireYm("28", "03")).toBeNull();
  });
});

describe("cardExpiryStatus", () => {
  it("期限月の2か月以上前は有効", () => {
    expect(cardExpiryStatus("202612", "2026-10-31")).toBe("valid");
  });
  it("期限月の前月と期限月は期限間近（期限月の末日まで使える）", () => {
    expect(cardExpiryStatus("202611", "2026-10-01")).toBe("expiring");
    expect(cardExpiryStatus("202610", "2026-10-31")).toBe("expiring");
  });
  it("期限月を過ぎたら期限切れ", () => {
    expect(cardExpiryStatus("202609", "2026-10-01")).toBe("expired");
  });
  it("年をまたぐ判定", () => {
    expect(cardExpiryStatus("202701", "2026-12-15")).toBe("expiring");
    expect(cardExpiryStatus("202612", "2027-01-01")).toBe("expired");
  });
  it("未取得は unknown", () => {
    expect(cardExpiryStatus(null, "2026-10-01")).toBe("unknown");
    expect(cardExpiryStatus("2026-1", "2026-10-01")).toBe("unknown");
  });
});

describe("isExpiryNoticeDay", () => {
  it("期限月の前月1日と期限月1日だけ true", () => {
    expect(isExpiryNoticeDay("202611", "2026-10-01")).toBe(true);
    expect(isExpiryNoticeDay("202611", "2026-11-01")).toBe(true);
    expect(isExpiryNoticeDay("202611", "2026-10-02")).toBe(false);
    expect(isExpiryNoticeDay("202611", "2026-09-01")).toBe(false);
    expect(isExpiryNoticeDay("202611", "2026-12-01")).toBe(false);
  });
});

describe("isValidExpireYm / formatExpireYm", () => {
  it("表示用に整形する", () => {
    expect(isValidExpireYm("202803")).toBe(true);
    expect(formatExpireYm("202803")).toBe("2028年3月");
    expect(formatExpireYm(null)).toBe("—");
  });
});
