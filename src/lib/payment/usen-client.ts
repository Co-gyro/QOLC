/**
 * USEN PSP API 共通HTTPユーティリティ
 *
 * - リクエストは application/x-www-form-urlencoded で POST（UTF-8）
 * - 会員ID決済APIのレスポンスは XML（フラットな <response> 配下のタグ）
 */
import { UsenApiError } from "./errors";

/** USEN本番環境のホスト名（誤送信ガードの判定対象） */
export const USEN_PROD_HOSTNAME = "inet-uketsuke1.netmove.jp";

/**
 * USEN本番エンドポイントへの誤送信ガード。
 *
 * 2026-06-29 に .env.local を本番設定のまま戻し忘れ、ローカルのE2E検証が
 * 本番USENへ実課金（¥163,323×3）した事故の再発防止策。送信先URLのホスト名で
 * 判定するため、環境変数の組み合わせに依存せず確実にブロックする。
 *
 * 本番ホストへの送信を許可する条件（いずれか）:
 *   - Vercel本番デプロイ（VERCEL_ENV === "production"）
 *   - 明示フラグ ALLOW_USEN_PROD === "1"（ローカルからの意図的な本番操作用）
 *
 * @throws {UsenApiError} 上記条件を満たさず本番ホストへ送信しようとした場合
 */
export function assertUsenEndpointAllowed(url: string): void {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // URL不正は通信処理側で失敗として扱う
    return;
  }
  if (hostname !== USEN_PROD_HOSTNAME) return;
  if (process.env.VERCEL_ENV === "production") return;
  if (process.env.ALLOW_USEN_PROD === "1") return;
  throw new UsenApiError(
    `USEN本番エンドポイント（${USEN_PROD_HOSTNAME}）への送信をブロックしました。` +
      "本番デプロイ以外から本番USENを操作する場合は、環境変数 ALLOW_USEN_PROD=1 を明示的に設定してください。"
  );
}

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
  assertUsenEndpointAllowed(opts.url);
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

export interface PostJsonOptions {
  url: string;
  body: unknown;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /** 追加ヘッダ（会員情報取得の X-Check-Cd 等） */
  headers?: Record<string, string>;
  method?: "POST" | "GET";
}

/**
 * JSON で POST/GET し、レスポンスを JSON としてパースして返す（トークン式EC決済API用）。
 * @throws {UsenApiError} 通信失敗・HTTP異常時
 */
export async function requestJson<T>(opts: PostJsonOptions): Promise<T> {
  assertUsenEndpointAllowed(opts.url);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const method = opts.method ?? "POST";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(opts.url, {
      method,
      headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
      body: method === "GET" ? undefined : JSON.stringify(opts.body ?? {}),
      signal: controller.signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch failed";
    throw new UsenApiError(`USEN API 通信失敗: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  // DEBUG: 開発時のみ全リクエスト結果をログ（HTTP status + body サンプル）
  if (process.env.NODE_ENV !== "production") {
    const snippet = text.length > 500 ? text.slice(0, 500) + "...(truncated)" : text;
    // eslint-disable-next-line no-console
    console.error(`[USEN HTTP] ${opts.url} → status=${res.status} body=${snippet}`);
  }
  if (!res.ok) {
    throw new UsenApiError(`USEN API がエラーを返しました (HTTP ${res.status}): ${text.slice(0, 200)}`, {
      httpStatus: res.status,
      responseBody: text,
    });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new UsenApiError(`USEN API レスポンスのJSONパースに失敗しました (body先頭: ${text.slice(0, 200)})`, {
      responseBody: text,
    });
  }
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
