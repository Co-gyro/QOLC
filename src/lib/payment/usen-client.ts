/**
 * USEN PSP API 共通HTTPクライアント
 *
 * - リクエストパラメータをHMACで署名
 * - x-www-form-urlencoded で送信（USEN PSP の規約）
 * - レスポンスを JSON or key=value 形式でパース
 * - エラー時は UsenApiError をスロー
 */
import { sign, buildSignaturePayload } from "./hmac";
import type { HmacAlgorithm, UsenApiResponseBase } from "./types";
import { UsenApiError } from "./errors";

/** USEN レスポンスの成功判定コード（IF仕様書に従う） */
const SUCCESS_CODES = new Set(["S", "0", "00", "OK"]);

/** USEN PSP API への POST リクエストを行うパラメータ */
export interface UsenRequestOptions {
  /** 完全URL（ベース + パス） */
  url: string;
  /** リクエストパラメータ（HMAC署名対象） */
  params: Record<string, string | number | undefined | null>;
  /** 署名アルゴリズム（EC=sha256, 会員ID=md5） */
  algorithm: HmacAlgorithm;
  /** 署名フィールド名（USEN PSP の規約に従う。既定: 'sig'） */
  signatureField?: string;
  /** タイムアウト（ms、既定: 30秒） */
  timeoutMs?: number;
  /** 注入可能な fetch（テスト用） */
  fetchImpl?: typeof fetch;
}

/** USEN レスポンスを application/x-www-form-urlencoded として解釈する */
export function parseUrlEncoded(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text) return out;
  for (const pair of text.split("&")) {
    if (!pair) continue;
    const idx = pair.indexOf("=");
    if (idx < 0) {
      out[decodeURIComponent(pair)] = "";
    } else {
      const k = decodeURIComponent(pair.slice(0, idx));
      const v = decodeURIComponent(pair.slice(idx + 1));
      out[k] = v;
    }
  }
  return out;
}

/**
 * USEN PSP API を呼び出す。レスポンスをパースして返す。
 * 成功判定（res_cd など）は呼び出し側で行うこと。
 *
 * @throws {UsenApiError} ネットワーク・HTTPステータス異常時
 */
export async function callUsenApi<TResp extends UsenApiResponseBase>(
  opts: UsenRequestOptions
): Promise<TResp> {
  const signatureField = opts.signatureField ?? "sig";
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  // 署名対象（署名フィールド自身は除外）
  const signTarget = buildSignaturePayload(opts.params);
  const signature = sign(opts.algorithm, signTarget);

  // body 構築
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params)) {
    if (v === undefined || v === null) continue;
    body.append(k, String(v));
  }
  body.append(signatureField, signature);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(opts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: body.toString(),
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new UsenApiError(`USEN API 通信失敗: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();

  if (!res.ok) {
    throw new UsenApiError(
      `USEN API がエラーを返しました (HTTP ${res.status})`,
      { httpStatus: res.status, responseBody: text }
    );
  }

  // レスポンスは text/plain or application/x-www-form-urlencoded の想定
  // JSON も念のためサポート
  const trimmed = text.trim();
  let parsed: Record<string, string> = {};
  if (trimmed.startsWith("{")) {
    try {
      parsed = JSON.parse(trimmed) as Record<string, string>;
    } catch {
      parsed = parseUrlEncoded(trimmed);
    }
  } else {
    parsed = parseUrlEncoded(trimmed);
  }

  return parsed as unknown as TResp;
}

/** USEN レスポンスが成功か判定する */
export function isUsenSuccess(resp: UsenApiResponseBase): boolean {
  return !!resp.res_cd && SUCCESS_CODES.has(resp.res_cd);
}

/** ベースURLとパスを結合する（末尾スラッシュ吸収） */
export function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return b + p;
}
