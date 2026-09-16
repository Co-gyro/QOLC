/**
 * QOLC → Selfish 連携 API の署名（純関数）
 *
 * 契約（docs/selfish-merchant-sync-design.md §4.4。Selfish 側も同じ式で検証する）:
 *   署名対象 = `${timestamp}\n${requestId}\n${rawBody}`
 *   署名     = HMAC-SHA256(共有鍵, 署名対象) の小文字 hex
 *   ヘッダ   = X-Qolc-Timestamp（UNIX 秒）/ X-Qolc-Request-Id（UUID）/ X-Qolc-Signature
 * 受信側は |now - timestamp| ≤ 300 秒、request-id の再利用なし、署名一致 を確認する。
 * 鍵は環境変数 SELFISH_PARTNER_KEY（ハードコード禁止・ログ出力禁止）。
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** 署名ヘッダ名 */
export const SELFISH_HEADERS = {
  timestamp: "X-Qolc-Timestamp",
  requestId: "X-Qolc-Request-Id",
  signature: "X-Qolc-Signature",
} as const;

/** 許容する時刻ずれ（秒） */
export const SELFISH_SIGNATURE_MAX_SKEW_SEC = 300;

/** 署名対象文字列を組み立てる */
export function buildSelfishSigningString(
  timestamp: string,
  requestId: string,
  rawBody: string
): string {
  return `${timestamp}\n${requestId}\n${rawBody}`;
}

/** 署名（hex 小文字）を計算する */
export function signSelfishRequest(
  key: string,
  timestamp: string,
  requestId: string,
  rawBody: string
): string {
  return createHmac("sha256", key)
    .update(buildSelfishSigningString(timestamp, requestId, rawBody), "utf8")
    .digest("hex");
}

/**
 * 署名を検証する（Selfish 側の参照実装。QOLC では受信しないがテストで往復を固定する）。
 * @param nowSec 現在時刻（UNIX 秒）
 */
export function verifySelfishSignature(input: {
  key: string;
  timestamp: string;
  requestId: string;
  rawBody: string;
  signature: string;
  nowSec: number;
}): { ok: true } | { ok: false; reason: "skew" | "mismatch" | "format" } {
  if (!/^\d{1,12}$/.test(input.timestamp) || !input.requestId) return { ok: false, reason: "format" };
  if (Math.abs(input.nowSec - Number(input.timestamp)) > SELFISH_SIGNATURE_MAX_SKEW_SEC) {
    return { ok: false, reason: "skew" };
  }
  const expected = signSelfishRequest(input.key, input.timestamp, input.requestId, input.rawBody);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature.toLowerCase(), "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "mismatch" };
  return { ok: true };
}
