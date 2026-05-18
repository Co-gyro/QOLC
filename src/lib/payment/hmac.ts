/**
 * USEN PSP API HMAC 署名モジュール
 *
 * USEN PSP は2種類のHMAC署名を使い分ける:
 *   1. EC決済API（カード登録）  : HMAC-SHA256
 *   2. 会員ID決済API（定常決済） : HMAC-MD5
 *
 * いずれも 64バイトバイナリ鍵（*.NMK ファイル）を使用する。
 *
 * セキュリティ:
 *   - 鍵ファイルは .gitignore で *.NMK 除外済み
 *   - process 起動時に1回だけ読み込み、メモリにキャッシュ
 *   - ログには絶対に鍵バイト列を出力しない
 *   - エラー時もメッセージに鍵の値を含めない
 */
import { createHmac, type BinaryLike } from "node:crypto";
import { readFileSync } from "node:fs";
import type { HmacAlgorithm } from "./types";
import { HmacKeyError } from "./errors";

let cachedKey: Buffer | null = null;
let cachedKeyPath: string | null = null;

/**
 * 環境変数 USEN_HMAC_KEY_PATH から HMAC キーをロードして返す（キャッシュ）。
 * テストや別環境の鍵を使う場合は {@link signWithKey} を直接呼ぶこと。
 */
export function loadHmacKey(): Buffer {
  const path = process.env.USEN_HMAC_KEY_PATH;
  if (!path) {
    throw new HmacKeyError("USEN_HMAC_KEY_PATH 環境変数が設定されていません");
  }
  if (cachedKey && cachedKeyPath === path) {
    return cachedKey;
  }
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch (_e) {
    // エラーメッセージにファイルパス以上の情報を漏らさない
    throw new HmacKeyError(`HMACキーファイルを読み込めませんでした: ${path}`);
  }
  if (buf.length === 0) {
    throw new HmacKeyError("HMACキーファイルが空です");
  }
  cachedKey = buf;
  cachedKeyPath = path;
  return buf;
}

/**
 * テスト用 / 内部用にキャッシュをクリアする。
 */
export function resetHmacKeyCache(): void {
  cachedKey = null;
  cachedKeyPath = null;
}

/**
 * 指定アルゴリズム / 任意の鍵で HMAC 署名を生成する。
 * 戻り値は16進小文字。
 *
 * @param algorithm - 'sha256' または 'md5'
 * @param key - HMAC キー（バイナリ）
 * @param payload - 署名対象（文字列または Buffer）
 */
export function signWithKey(
  algorithm: HmacAlgorithm,
  key: BinaryLike,
  payload: string | Buffer
): string {
  const algo = algorithm === "sha256" ? "sha256" : "md5";
  const hmac = createHmac(algo, key);
  hmac.update(payload);
  return hmac.digest("hex");
}

/**
 * 環境変数 USEN_HMAC_KEY_PATH のキーで HMAC 署名を生成する。
 *
 * EC決済API（カード登録用）は 'sha256'、
 * 会員ID決済API（定常決済用）は 'md5' を指定する。
 */
export function sign(
  algorithm: HmacAlgorithm,
  payload: string | Buffer
): string {
  const key = loadHmacKey();
  return signWithKey(algorithm, key, payload);
}

/**
 * USEN PSP のリクエストパラメータを「キーのASCII順で連結」する規約に基づき
 * 署名対象文字列を組み立てる。
 *
 * 仕様: 値を connector（既定 ""）で連結。NULL/undefined は除外。
 * 順序はキーの ASCII 昇順（USEN PSP IF仕様書に準拠）。
 *
 * @param params - リクエストパラメータ（key: string, value: string | number）
 * @param connector - 値の区切り文字（既定: ""）
 */
export function buildSignaturePayload(
  params: Record<string, string | number | undefined | null>,
  connector = ""
): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== null)
    .sort();
  return keys.map((k) => String(params[k])).join(connector);
}
