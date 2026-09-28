/**
 * 加盟店API が使う USEN 接続先の解決（テスト／本番）
 *
 * 1つのデプロイで、加盟店の資格情報の environment によって USEN の接続先を切り替える。
 *   - production: 加盟店の merchants.mall_code ＋ 本番 group_id・サイト鍵（既存の USEN_* 環境変数）
 *   - test:       USEN のテストモール（USEN_TEST_* 環境変数）。実課金は発生しない
 * いずれも group_id 方式（サイト鍵1本で全APIを署名）に限定する。USEN推奨方式で、
 * 本番の介護決済も同方式で稼働している。
 *
 * ホストはテスト・本番とも inet-uketsuke1.netmove.jp（2026-08-18確認）のため、
 * ベースURLは既存の USEN_TOKEN_EC_API_BASE_URL / USEN_MEMBER_API_BASE_URL を共用する。
 */
import { readFileSync } from "node:fs";
import { loadUsenKey } from "@/lib/payment/hmac";

/** USEN の接続設定一式 */
export interface UsenProfile {
  environment: "test" | "production";
  /** 受注コードの上位4桁 */
  mallCd: string;
  groupId: string;
  /** サイトのHMACキー（64バイト） */
  key: Buffer;
  tokenApiBaseUrl: string;
  memberApiBaseUrl: string;
  /** 決済画面で読み込む USEN のトークンJS */
  tokenJsUrl: string;
  /** SDK の apiBaseUrl（通常は null＝SDK既定） */
  sdkApiBaseUrl: string | null;
}

/** 加盟店API の設定不備（運用側で直す必要がある） */
export class UsenProfileError extends Error {
  /** @param message - 不足している設定の説明（鍵の値は含めない） */
  constructor(message: string) {
    super(message);
    this.name = "UsenProfileError";
  }
}

/**
 * 必須の環境変数を取得する。
 */
function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name];
  if (!v) throw new UsenProfileError(`${name} が設定されていません`);
  return v;
}

/**
 * テスト用サイト鍵を読む（base64 優先、無ければファイルパス）。64バイト厳格。
 */
function loadTestKey(env: NodeJS.ProcessEnv): Buffer {
  const b64 = env.USEN_TEST_SITE_HMAC_KEY_B64;
  const path = env.USEN_TEST_SITE_HMAC_KEY_PATH;
  let key: Buffer;
  if (b64) {
    key = Buffer.from(b64.replace(/\s+/g, ""), "base64");
  } else if (path) {
    try {
      key = readFileSync(path);
    } catch {
      throw new UsenProfileError(`テスト用HMACキーファイルを読み込めませんでした: ${path}`);
    }
  } else {
    throw new UsenProfileError("USEN_TEST_SITE_HMAC_KEY_B64 または USEN_TEST_SITE_HMAC_KEY_PATH が設定されていません");
  }
  if (key.length !== 64) {
    throw new UsenProfileError(`テスト用HMACキーは64バイトである必要があります（実際: ${key.length}バイト）`);
  }
  return key;
}

/**
 * 環境に応じた USEN 接続設定を返す。
 *
 * @param environment - 資格情報の環境
 * @param merchantMallCode - 本番で使う加盟店のモールコード（merchants.mall_code）
 * @param env - 環境変数（テスト用に注入可能）
 * @throws {UsenProfileError} 設定不足、またはテストと本番の group_id が同一（実課金の恐れ）
 */
export function resolveUsenProfile(
  environment: "test" | "production",
  merchantMallCode: string | null,
  env: NodeJS.ProcessEnv = process.env
): UsenProfile {
  const tokenApiBaseUrl = required(env, "USEN_TOKEN_EC_API_BASE_URL");
  const memberApiBaseUrl = required(env, "USEN_MEMBER_API_BASE_URL");

  if (environment === "production") {
    if (!merchantMallCode || !/^[A-Z0-9]{4}$/.test(merchantMallCode)) {
      throw new UsenProfileError("加盟店のモールコード（merchants.mall_code）が設定されていません");
    }
    return {
      environment,
      mallCd: merchantMallCode,
      groupId: required(env, "USEN_GROUP_ID"),
      key: loadUsenKey("site"),
      tokenApiBaseUrl,
      memberApiBaseUrl,
      tokenJsUrl: required(env, "NEXT_PUBLIC_USEN_TOKEN_JS_URL"),
      sdkApiBaseUrl: env.NEXT_PUBLIC_USEN_TOKEN_EC_API_BASE_URL || null,
    };
  }

  const groupId = required(env, "USEN_TEST_GROUP_ID");
  if (env.USEN_GROUP_ID && groupId === env.USEN_GROUP_ID) {
    // 取り違えるとテスト用の資格情報で本番課金が成立しうるため、起動時点で止める
    throw new UsenProfileError("USEN_TEST_GROUP_ID が本番の USEN_GROUP_ID と同じです");
  }
  const mallCd = required(env, "USEN_TEST_MALL_CD");
  if (!/^[A-Z0-9]{4}$/.test(mallCd)) {
    throw new UsenProfileError("USEN_TEST_MALL_CD の形式が不正です");
  }
  return {
    environment,
    mallCd,
    groupId,
    key: loadTestKey(env),
    tokenApiBaseUrl,
    memberApiBaseUrl,
    tokenJsUrl: env.USEN_TEST_TOKEN_JS_URL || required(env, "NEXT_PUBLIC_USEN_TOKEN_JS_URL"),
    sdkApiBaseUrl: env.USEN_TEST_TOKEN_SDK_API_BASE_URL || null,
  };
}
