/**
 * Selfish（精算システム）連携 API クライアント（server-only）
 *
 * - 送信先は環境変数 SELFISH_API_BASE_URL（例: https://selfish-web-web.vercel.app）
 * - 署名鍵は環境変数 SELFISH_PARTNER_KEY（ハードコード禁止・ログ出力禁止）
 * - どちらか未設定なら「未設定」を返し、送信しない（サイレント成功にはしない）
 * - Selfish 側の応答規約: 2xx → { ok: true, result, merchant_id, store_id }
 *                        4xx → { ok: false, code, message, details? }
 */
import { randomUUID } from "node:crypto";
import type { SelfishMerchantPayload } from "./build-payload";
import { SELFISH_HEADERS, signSelfishRequest } from "./signature";

/** 連携先の設定（環境変数から） */
export interface SelfishConfig {
  baseUrl: string;
  key: string;
}

/** 環境変数から設定を読む。未設定なら null */
export function getSelfishConfig(): SelfishConfig | null {
  const baseUrl = (process.env.SELFISH_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = (process.env.SELFISH_PARTNER_KEY ?? "").trim();
  if (!baseUrl || !key) return null;
  return { baseUrl, key };
}

/** Selfish の登録結果（成功） */
export interface SelfishRegisterOk {
  ok: true;
  result: "created" | "updated" | "unchanged";
  merchant_id?: string;
  store_id?: string;
  /** 送信時の request-id（両システムの監査突合キー） */
  request_id: string;
}

/** Selfish の登録結果（失敗。HTTP エラー・通信エラーを含む） */
export interface SelfishRegisterNg {
  ok: false;
  /** needs_approval / conflict / validation / unauthorized / network / http_<status> など */
  code: string;
  message: string;
  details?: unknown;
  request_id: string;
}

export type SelfishRegisterResult = SelfishRegisterOk | SelfishRegisterNg;

/** 加盟店登録 API のパス */
export const SELFISH_MERCHANTS_PATH = "/api/partners/merchants";

/** 通信タイムアウト（ms） */
const TIMEOUT_MS = 15_000;

/**
 * Selfish へ加盟店登録ペイロードを送信する。
 * @param payload buildSelfishPayload の結果（ready=true のもの）
 * @param operatorEmail 操作者メール（source.operator_email に付与）
 */
export async function registerMerchantToSelfish(
  config: SelfishConfig,
  payload: SelfishMerchantPayload,
  operatorEmail: string | null
): Promise<SelfishRegisterResult> {
  const requestId = randomUUID();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    ...payload,
    source: { ...payload.source, operator_email: operatorEmail ?? undefined },
  });
  const signature = signSelfishRequest(config.key, timestamp, requestId, body);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${config.baseUrl}${SELFISH_MERCHANTS_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [SELFISH_HEADERS.timestamp]: timestamp,
        [SELFISH_HEADERS.requestId]: requestId,
        [SELFISH_HEADERS.signature]: signature,
      },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await res.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    if (res.ok && json && json.ok === true) {
      const result = json.result;
      return {
        ok: true,
        result: result === "created" || result === "updated" ? result : "unchanged",
        merchant_id: typeof json.merchant_id === "string" ? json.merchant_id : undefined,
        store_id: typeof json.store_id === "string" ? json.store_id : undefined,
        request_id: requestId,
      };
    }
    return {
      ok: false,
      code: typeof json?.code === "string" ? json.code : `http_${res.status}`,
      message:
        typeof json?.message === "string"
          ? json.message
          : `Selfish が ${res.status} を返しました${text ? `: ${text.slice(0, 200)}` : ""}`,
      details: json?.details,
      request_id: requestId,
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      code: aborted ? "timeout" : "network",
      message: aborted
        ? `Selfish が ${TIMEOUT_MS / 1000} 秒以内に応答しませんでした`
        : `Selfish へ接続できません: ${e instanceof Error ? e.message : String(e)}`,
      request_id: requestId,
    };
  } finally {
    clearTimeout(timer);
  }
}
