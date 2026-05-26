/**
 * USEN PSP API チェックコード（署名）モジュール
 *
 * 仕様（会員ID決済IF仕様書 2.4.2 / 3DセキュアEC決済導入ガイド 4.2.3）:
 *   チェックコード = "HM" + HMAC-hex(各API指定パラメータを "," で連結した文字列, HMACキー)
 *     - 会員ID決済API : HMAC-MD5
 *     - EC決済API(3DS): HMAC-SHA256
 *   HMACキーは 64バイトバイナリで、サイトコード/モールコードごとに異なる:
 *     - サイトのキー: 会員登録系API（entrybyjutyucd, get, inactivate, activate, delete）
 *     - モールのキー: 与信/売上/取消系API（authbymemberid, salesadd, void 等）
 *
 * セキュリティ:
 *   - 鍵ファイル(*.NMK)は .gitignore 除外済み。パスは環境変数経由（ハードコード禁止）
 *   - 鍵バイト列・パスをログ出力しない
 */
import { createHmac, type BinaryLike } from "node:crypto";
import { readFileSync } from "node:fs";
import type { HmacAlgorithm } from "./types";
import { HmacKeyError } from "./errors";

/** チェックコードの固定プレフィックス（仕様で規定） */
export const CHECK_CODE_PREFIX = "HM";

/** HMACキーの種別（サイト or モール） */
export type UsenKeyType = "site" | "mall";

const ENV_BY_TYPE: Record<UsenKeyType, string> = {
  site: "USEN_SITE_HMAC_KEY_PATH",
  mall: "USEN_MALL_HMAC_KEY_PATH",
};

const keyCache = new Map<string, Buffer>();

/**
 * 指定種別の HMAC キーを環境変数のパスからロードする（パス単位でキャッシュ）。
 */
export function loadUsenKey(type: UsenKeyType): Buffer {
  const envName = ENV_BY_TYPE[type];
  const path = process.env[envName];
  if (!path) {
    throw new HmacKeyError(`${envName} 環境変数が設定されていません`);
  }
  const cached = keyCache.get(path);
  if (cached) return cached;

  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch (_e) {
    // エラーメッセージに鍵の内容を漏らさない（パスのみ）
    throw new HmacKeyError(`HMACキーファイルを読み込めませんでした: ${path}`);
  }
  if (buf.length === 0) {
    throw new HmacKeyError("HMACキーファイルが空です");
  }
  keyCache.set(path, buf);
  return buf;
}

/** テスト用・再読込用にキャッシュをクリアする。 */
export function resetHmacKeyCache(): void {
  keyCache.clear();
}

/**
 * 任意の鍵で HMAC を計算し、16進小文字文字列を返す（プレフィックスなし）。
 * テストや低レベル用途向け。
 */
export function hmacHex(
  algorithm: HmacAlgorithm,
  key: BinaryLike,
  payload: string
): string {
  const algo = algorithm === "sha256" ? "sha256" : "md5";
  return createHmac(algo, key).update(payload, "utf8").digest("hex");
}

/**
 * チェックコードを生成する: "HM" + HMAC-hex(fields を "," で連結, key)。
 *
 * @param algorithm - 'md5'（会員ID決済）/ 'sha256'（EC決済）
 * @param key - HMACキー（64バイトバイナリ）
 * @param fields - 各API仕様で規定された順序のパラメータ値
 */
export function generateCheckCodeWithKey(
  algorithm: HmacAlgorithm,
  key: BinaryLike,
  fields: Array<string | number>
): string {
  const data = fields.map((f) => String(f)).join(",");
  return CHECK_CODE_PREFIX + hmacHex(algorithm, key, data);
}

/**
 * 環境変数のキー（サイト or モール）でチェックコードを生成する。
 *
 * @param algorithm - 'md5' / 'sha256'
 * @param keyType - 'site' / 'mall'
 * @param fields - 署名対象のパラメータ値（仕様順）
 */
export function generateCheckCode(
  algorithm: HmacAlgorithm,
  keyType: UsenKeyType,
  fields: Array<string | number>
): string {
  const key = loadUsenKey(keyType);
  return generateCheckCodeWithKey(algorithm, key, fields);
}
