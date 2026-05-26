/**
 * USEN PSP API 共通HTTPユーティリティ
 *
 * - リクエストは application/x-www-form-urlencoded で POST（UTF-8）
 * - 会員ID決済APIのレスポンスは XML（フラットな <response> 配下のタグ）
 */
import { UsenApiError } from "./errors";

/** ベースURLとパスを結合（重複スラッシュ吸収） */
export function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return b + p;
}

/**
 * フラットな XML（<response><tag>value</tag>...</response>）を
 * { tag: value } の連想配列にパースする。
 * 仕様上ネストは無いため軽量な正規表現で処理する。
 */
export function parseXmlResponse(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!xml) return out;
  // <response> 配下を対象にする（無ければ全体）
  const bodyMatch = xml.match(/<response[^>]*>([\s\S]*?)<\/response>/i);
  const body = bodyMatch ? bodyMatch[1] : xml;
  const tagRe = /<([A-Za-z_][\w.-]*)>([\s\S]*?)<\/\1>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(body)) !== null) {
    out[m[1]] = decodeXmlEntities(m[2].trim());
  }
  return out;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export interface PostFormOptions {
  url: string;
  /** フォームパラメータ（check_cd も含めて渡す） */
  params: Record<string, string | number | undefined | null>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * x-www-form-urlencoded で POST し、レスポンス本文（テキスト）を返す。
 * @throws {UsenApiError} 通信失敗・HTTP異常時
 */
export async function postForm(opts: PostFormOptions): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params)) {
    if (v === undefined || v === null) continue;
    body.append(k, String(v));
  }

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
    throw new UsenApiError(`USEN API がエラーを返しました (HTTP ${res.status})`, {
      httpStatus: res.status,
      responseBody: text,
    });
  }
  return text;
}

/** 会員ID決済APIのXMLレスポンスをパースして共通形に整える */
export interface UsenXmlResult {
  jutyu_cd?: string;
  result?: "ok" | "ng" | string;
  code?: string;
  ucorp?: string;
  [key: string]: string | undefined;
}

/** result === "ok" を成功とみなす */
export function isOk(result: UsenXmlResult): boolean {
  return result.result === "ok";
}
