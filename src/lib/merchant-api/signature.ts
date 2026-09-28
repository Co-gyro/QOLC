/**
 * 加盟店API の署名（接続仕様書 v1.0 第3章・第7章・第10章）
 *
 * - リクエスト／通知: X-UD-Signature: t={unix},v1={hex}
 *     v1 = HMAC_SHA256(secret, "{t}.{body}")（GET は body を空文字列として扱う）
 * - 戻り（return_url）: sig = HMAC_SHA256(secret, "{order_id}.{payment_id}.{status}.{t}")
 * - 16進小文字。タイムスタンプの許容差は ±5分
 *
 * 署名鍵（secret）は文字列をそのまま UTF-8 の鍵として使う。
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** タイムスタンプの許容差（秒） */
export const SIGNATURE_TOLERANCE_SEC = 300;

/**
 * HMAC-SHA256 の16進小文字を返す。
 *
 * @param secret - 署名鍵
 * @param payload - 署名対象文字列
 */
export function hmacSha256Hex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

/**
 * リクエスト／通知の v1 署名を計算する。
 *
 * @param secret - 署名鍵
 * @param timestamp - UNIX秒
 * @param body - リクエストボディ（GET は空文字列）
 */
export function computeSignature(secret: string, timestamp: number, body: string): string {
  return hmacSha256Hex(secret, `${timestamp}.${body}`);
}

/**
 * X-UD-Signature ヘッダ値を組み立てる（当社から送る通知で使用）。
 */
export function buildSignatureHeader(secret: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${computeSignature(secret, timestamp, body)}`;
}

/** 解析済みの署名ヘッダ */
export interface ParsedSignatureHeader {
  timestamp: number;
  signatures: string[];
}

/**
 * X-UD-Signature ヘッダを解析する。形式不正なら null。
 * v1 は複数並んでもよい（鍵の切替期間に加盟店側が新旧両方で署名するケース）。
 */
export function parseSignatureHeader(header: string | null | undefined): ParsedSignatureHeader | null {
  if (!header) return null;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === "t" && /^\d{1,12}$/.test(value)) timestamp = Number(value);
    if (key === "v1" && /^[0-9a-f]{64}$/.test(value)) signatures.push(value);
  }
  if (timestamp === null || signatures.length === 0) return null;
  return { timestamp, signatures };
}

/**
 * 16進文字列を定数時間で比較する（長さが違えば false）。
 */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/** 署名検証の結果 */
export type SignatureVerifyResult =
  | { ok: true }
  | { ok: false; reason: "malformed" | "timestamp_out_of_range" | "mismatch" };

/**
 * リクエスト署名を検証する。
 *
 * @param args.header - X-UD-Signature の値
 * @param args.body - 受信したボディの生文字列（GET は空文字列）
 * @param args.secrets - 有効な署名鍵（再発行直後は新旧2本）
 * @param args.nowSec - 現在のUNIX秒（テスト用に注入可能）
 */
export function verifyRequestSignature(args: {
  header: string | null | undefined;
  body: string;
  secrets: string[];
  nowSec?: number;
}): SignatureVerifyResult {
  const parsed = parseSignatureHeader(args.header);
  if (!parsed) return { ok: false, reason: "malformed" };
  const now = args.nowSec ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - parsed.timestamp) > SIGNATURE_TOLERANCE_SEC) {
    return { ok: false, reason: "timestamp_out_of_range" };
  }
  for (const secret of args.secrets) {
    const expected = computeSignature(secret, parsed.timestamp, args.body);
    if (parsed.signatures.some((s) => safeEqualHex(s, expected))) return { ok: true };
  }
  return { ok: false, reason: "mismatch" };
}

/**
 * 戻り（return_url）の sig を計算する。
 */
export function computeReturnSignature(
  secret: string,
  args: { orderId: string; paymentId: string; status: string; timestamp: number }
): string {
  return hmacSha256Hex(secret, `${args.orderId}.${args.paymentId}.${args.status}.${args.timestamp}`);
}

/**
 * 加盟店の return_url に戻りパラメータを付けたURLを作る。
 * 既存のクエリ文字列は保持し、同名パラメータは上書きする。
 */
export function buildReturnUrl(
  baseUrl: string,
  secret: string,
  args: { orderId: string; paymentId: string; status: string; timestamp: number }
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("payment_id", args.paymentId);
  url.searchParams.set("order_id", args.orderId);
  url.searchParams.set("status", args.status);
  url.searchParams.set("t", String(args.timestamp));
  url.searchParams.set("sig", computeReturnSignature(secret, args));
  return url.toString();
}
