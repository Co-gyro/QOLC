/**
 * 紹介サイトホスト → アプリ本体転送（src/lib/site/app-redirect.ts）のテスト。
 * qolc.jp/login・qolc.jp/admin が 404 に落ちず app.qolc.jp へ飛ぶことを保証する。
 */
import { describe, it, expect } from "vitest";
import {
  appRedirectUrl,
  isAppOnlyPath,
  resolveAppOrigin,
} from "../../src/lib/site/app-redirect";

describe("isAppOnlyPath", () => {
  it("アプリ側のパスを判定する", () => {
    for (const p of [
      "/login",
      "/login/",
      "/admin",
      "/admin/dashboard",
      "/facility/statements",
      "/provider/upload",
      "/user/home",
      "/liff/receipt",
      "/invite/abc",
      "/udpay",
    ]) {
      expect(isAppOnlyPath(p), p).toBe(true);
    }
  });

  it("紹介サイト側のパスは対象外", () => {
    for (const p of ["/", "/apply", "/contact", "/jcb", "/site", "/logins"]) {
      expect(isAppOnlyPath(p), p).toBe(false);
    }
  });
});

describe("resolveAppOrigin", () => {
  it("https の NEXT_PUBLIC_APP_URL を採用する", () => {
    expect(resolveAppOrigin("https://app.qolc.jp")).toBe("https://app.qolc.jp");
    expect(resolveAppOrigin("https://app.qolc.jp/")).toBe("https://app.qolc.jp");
  });

  it("localhost・不正値は本番既定にフォールバックする", () => {
    // 公開サイトから localhost へ飛ばさないためのガード
    expect(resolveAppOrigin("http://localhost:3000")).toBe("https://app.qolc.jp");
    expect(resolveAppOrigin("not-a-url")).toBe("https://app.qolc.jp");
    expect(resolveAppOrigin(undefined)).toBe("https://app.qolc.jp");
  });
});

describe("appRedirectUrl", () => {
  it("アプリ側パスは app.qolc.jp の同一パスへ転送する", () => {
    expect(appRedirectUrl("/admin", "", "https://app.qolc.jp")).toBe(
      "https://app.qolc.jp/admin"
    );
  });

  it("クエリ文字列を保持する", () => {
    expect(
      appRedirectUrl("/login", "?next=%2Fadmin", "https://app.qolc.jp")
    ).toBe("https://app.qolc.jp/login?next=%2Fadmin");
  });

  it("紹介サイト側パスは転送しない（null）", () => {
    expect(appRedirectUrl("/apply", "", "https://app.qolc.jp")).toBeNull();
    expect(appRedirectUrl("/", "", "https://app.qolc.jp")).toBeNull();
  });
});
