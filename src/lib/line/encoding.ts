/**
 * LINE 連携で使う base64url / 定数時間比較ユーティリティ。
 */
import { timingSafeEqual } from "node:crypto";

/** Buffer/文字列を base64url（パディングなし）へエンコードする。 */
export function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url 文字列を Buffer へデコードする。 */
export function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

/**
 * 2つの文字列をタイミング攻撃に耐える形で比較する。
 * 長さが異なる場合は false（長さ自体は秘密ではない想定）。
 */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
