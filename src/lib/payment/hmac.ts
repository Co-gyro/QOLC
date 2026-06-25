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
 * 鍵の供給方法（2系統・base64優先）:
 *   1. base64環境変数（*_HMAC_KEY_B64）: 64バイトバイナリ鍵をbase64化した文字列。
 *      Vercel等のファイルシステムを持たない実行環境向け（ファイルレス）。
 *   2. ファイルパス環境変数（*_HMAC_KEY_PATH）: ローカル開発で *.NMK を直接参照。
 *   両方設定時は base64 を優先する。
 *
 * セキュリティ:
 *   - 鍵ファイル(*.NMK)は .gitignore 除外済み。パス/base64値は環境変数経由（ハードコード禁止）
 *   - 鍵バイト列・パス・base64値をログ出力しない
 */
import { createHmac, type BinaryLike } from "node:crypto";
import { readFileSync } from "node:fs";
import type { HmacAlgorithm } from "./types";
import { HmacKeyError } from "./errors";

/** チェックコードの固定プレフィックス（仕様で規定） */
export const CHECK_CODE_PREFIX = "HM";

/** HMACキーの種別（サイト or モール） */
export type UsenKeyType = "site" | "mall";

/** ファイルパス指定の環境変数名（ローカル開発用） */
const PATH_ENV_BY_TYPE: Record<UsenKeyType, string> = {
  site: "USEN_SITE_HMAC_KEY_PATH",
  mall: "USEN_MALL_HMAC_KEY_PATH",
};

/** base64指定の環境変数名（Vercel等ファイルレス環境用・優先） */
const B64_ENV_BY_TYPE: Record<UsenKeyType, string> = {
  site: "USEN_SITE_HMAC_KEY_B64",
  mall: "USEN_MALL_HMAC_KEY_B64",
};

/** HMACキーの規定バイト長（USEN仕様: 64バイトバイナリ） */
const EXPECTED_KEY_BYTES = 64;

const keyCache = new Map<string, Buffer>();

/**
 * base64文字列を 64バイトの鍵バッファにデコードする。
 * 貼り付けミス・切り詰めを検知するため、デコード後のバイト長を厳格に検証する。
 */
function decodeKeyB64(value: string, envName: string): Buffer {
  // Vercelのコピー時に混入しがちな前後の空白・改行を除去
  const trimmed = value.replace(/\s+/g, "");
  const buf = Buffer.from(trimmed, "base64");
  if (buf.length !== EXPECTED_KEY_BYTES) {
    // 鍵内容は出さず、長さ不一致のみ通知（切り詰め・誤エンコードの早期検知）
    throw new HmacKeyError(
      `${envName} はbase64デコード後 ${EXPECTED_KEY_BYTES}バイトである必要があります（実際: ${buf.length}バイト）`
    );
  }
  return buf;
}

/**
 * 指定種別の HMAC キーを環境変数からロードする（出所単位でキャッシュ）。
 * base64環境変数（*_B64）を優先し、未設定ならファイルパス（*_PATH）を読む。
 */
export function loadUsenKey(type: UsenKeyType): Buffer {
  const b64Env = B64_ENV_BY_TYPE[type];
  const pathEnv = PATH_ENV_BY_TYPE[type];
  const b64Value = process.env[b64Env];
  const pathValue = process.env[pathEnv];

  // 出所ごとに一意なキャッシュキー（base64優先）
  const cacheKey = b64Value
    ? `b64:${b64Env}`
    : pathValue
      ? `path:${pathValue}`
      : null;
  if (!cacheKey) {
    throw new HmacKeyError(
      `${b64Env} または ${pathEnv} 環境変数が設定されていません`
    );
  }
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  let buf: Buffer;
  if (b64Value) {
    buf = decodeKeyB64(b64Value, b64Env);
  } else {
    try {
      buf = readFileSync(pathValue as string);
    } catch (_e) {
      // エラーメッセージに鍵の内容を漏らさない（パスのみ）
      throw new HmacKeyError(`HMACキーファイルを読み込めませんでした: ${pathValue}`);
    }
    if (buf.length === 0) {
      throw new HmacKeyError("HMACキーファイルが空です");
    }
  }
  keyCache.set(cacheKey, buf);
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
