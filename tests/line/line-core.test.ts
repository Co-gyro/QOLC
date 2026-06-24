import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

import { base64UrlEncode, base64UrlDecode, safeEqual } from "@/lib/line/encoding";
import { verifyLineSignature } from "@/lib/line/signature";
import { signState, verifyState } from "@/lib/line/state";
import { verifyLineIdToken } from "@/lib/line/verify";
import { buildAuthorizeUrl, generateNonce } from "@/lib/line/oauth";
import { buildTextMessage } from "@/lib/line/messaging";
import { LineVerificationError } from "@/lib/line/errors";
import type { LineIdTokenClaims, LineLoginConfig } from "@/lib/line/types";

const CHANNEL_ID = "1234567890";
const CHANNEL_SECRET = "test-channel-secret-abcdef";

/** HS256 で JWT を組み立てる（LINE id_token を模擬） */
function makeIdToken(claims: Partial<LineIdTokenClaims>, secret = CHANNEL_SECRET, alg = "HS256"): string {
  const header = base64UrlEncode(JSON.stringify({ alg, typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify(claims));
  const sig = base64UrlEncode(createHmac("sha256", secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

const NOW = 1_750_000_000;
const validClaims: LineIdTokenClaims = {
  iss: "https://access.line.me",
  sub: "U1111111111111111111111111111111",
  aud: CHANNEL_ID,
  exp: NOW + 3600,
  iat: NOW,
  nonce: "nonce-xyz",
  name: "山田 太郎",
};

describe("encoding", () => {
  it("base64url round-trip", () => {
    const s = "あいうえお/+=test";
    expect(base64UrlDecode(base64UrlEncode(s)).toString("utf8")).toBe(s);
  });
  it("base64url にパディング/記号を含まない", () => {
    const enc = base64UrlEncode("ff>?ff");
    expect(enc).not.toMatch(/[+/=]/);
  });
  it("safeEqual: 一致/不一致/長さ違い", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("verifyLineSignature (Webhook)", () => {
  const body = JSON.stringify({ events: [] });
  const sig = createHmac("sha256", CHANNEL_SECRET).update(body).digest("base64");

  it("正しい署名を検証できる", () => {
    expect(verifyLineSignature(body, sig, CHANNEL_SECRET)).toBe(true);
  });
  it("改ざんされたボディを拒否する", () => {
    expect(verifyLineSignature(body + "x", sig, CHANNEL_SECRET)).toBe(false);
  });
  it("署名なしを拒否する", () => {
    expect(verifyLineSignature(body, null, CHANNEL_SECRET)).toBe(false);
  });
  it("別シークレットの署名を拒否する", () => {
    const bad = createHmac("sha256", "other").update(body).digest("base64");
    expect(verifyLineSignature(body, bad, CHANNEL_SECRET)).toBe(false);
  });
});

describe("state 署名/検証", () => {
  it("署名→検証で往復できる", () => {
    const token = signState({ nonce: "n1", next: "/user/home", iat: NOW }, CHANNEL_SECRET);
    const p = verifyState(token, CHANNEL_SECRET, 600, NOW + 10);
    expect(p.nonce).toBe("n1");
    expect(p.next).toBe("/user/home");
  });
  it("オープンリダイレクトになる next を除去する", () => {
    const token = signState({ nonce: "n1", next: "//evil.com", iat: NOW }, CHANNEL_SECRET);
    const p = verifyState(token, CHANNEL_SECRET, 600, NOW);
    expect(p.next).toBeUndefined();
  });
  it("招待トークンを引き回せる", () => {
    const token = signState({ nonce: "n1", inviteToken: "inv-abc", iat: NOW }, CHANNEL_SECRET);
    expect(verifyState(token, CHANNEL_SECRET, 600, NOW).inviteToken).toBe("inv-abc");
  });
  it("署名改ざんを拒否する", () => {
    const token = signState({ nonce: "n1", iat: NOW }, CHANNEL_SECRET);
    const tampered = token.slice(0, -2) + "xx";
    expect(() => verifyState(tampered, CHANNEL_SECRET, 600, NOW)).toThrow(LineVerificationError);
  });
  it("期限切れを拒否する", () => {
    const token = signState({ nonce: "n1", iat: NOW }, CHANNEL_SECRET);
    expect(() => verifyState(token, CHANNEL_SECRET, 600, NOW + 601)).toThrow(LineVerificationError);
  });
});

describe("verifyLineIdToken", () => {
  it("正当な id_token を検証してクレームを返す", () => {
    const token = makeIdToken(validClaims);
    const claims = verifyLineIdToken(token, CHANNEL_ID, CHANNEL_SECRET, "nonce-xyz", NOW + 1);
    expect(claims.sub).toBe(validClaims.sub);
    expect(claims.name).toBe("山田 太郎");
  });
  it("alg=none ダウングレードを拒否する", () => {
    const token = makeIdToken(validClaims, CHANNEL_SECRET, "none");
    expect(() => verifyLineIdToken(token, CHANNEL_ID, CHANNEL_SECRET, "nonce-xyz", NOW)).toThrow(
      LineVerificationError
    );
  });
  it("署名鍵が違えば拒否する", () => {
    const token = makeIdToken(validClaims, "wrong-secret");
    expect(() => verifyLineIdToken(token, CHANNEL_ID, CHANNEL_SECRET, "nonce-xyz", NOW)).toThrow(
      LineVerificationError
    );
  });
  it("aud が別チャネルなら拒否する", () => {
    const token = makeIdToken({ ...validClaims, aud: "9999" });
    expect(() => verifyLineIdToken(token, CHANNEL_ID, CHANNEL_SECRET, "nonce-xyz", NOW)).toThrow(
      LineVerificationError
    );
  });
  it("iss が不正なら拒否する", () => {
    const token = makeIdToken({ ...validClaims, iss: "https://evil.example" });
    expect(() => verifyLineIdToken(token, CHANNEL_ID, CHANNEL_SECRET, "nonce-xyz", NOW)).toThrow(
      LineVerificationError
    );
  });
  it("期限切れを拒否する", () => {
    const token = makeIdToken({ ...validClaims, exp: NOW - 1 });
    expect(() => verifyLineIdToken(token, CHANNEL_ID, CHANNEL_SECRET, "nonce-xyz", NOW)).toThrow(
      LineVerificationError
    );
  });
  it("nonce 不一致（リプレイ）を拒否する", () => {
    const token = makeIdToken(validClaims);
    expect(() => verifyLineIdToken(token, CHANNEL_ID, CHANNEL_SECRET, "other-nonce", NOW)).toThrow(
      LineVerificationError
    );
  });
});

describe("buildAuthorizeUrl / generateNonce", () => {
  const config: LineLoginConfig = {
    channelId: CHANNEL_ID,
    channelSecret: CHANNEL_SECRET,
    redirectUri: "https://app.qolc.jp/api/auth/line/callback",
  };
  it("必須パラメータを含む URL を生成する", () => {
    const url = new URL(buildAuthorizeUrl(config, "state-token", "nonce-1"));
    expect(url.origin + url.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(CHANNEL_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(url.searchParams.get("state")).toBe("state-token");
    expect(url.searchParams.get("nonce")).toBe("nonce-1");
    expect(url.searchParams.get("scope")).toBe("openid profile");
  });
  it("generateNonce は URL セーフでユニーク", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
    expect(a).not.toMatch(/[+/=]/);
  });
});

describe("buildTextMessage", () => {
  it("title のみ", () => {
    expect(buildTextMessage("決済完了")).toEqual({ type: "text", text: "決済完了" });
  });
  it("title + body を結合する", () => {
    expect(buildTextMessage("決済完了", "1,200円")).toEqual({
      type: "text",
      text: "決済完了\n\n1,200円",
    });
  });
  it("5000 文字上限で切り詰める", () => {
    const msg = buildTextMessage("x".repeat(6000)) as { text: string };
    expect(msg.text.length).toBeLessThanOrEqual(4900);
  });
});
