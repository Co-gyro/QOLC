/**
 * 加盟店API の署名鍵の生成・暗号化保管
 *
 * 署名鍵は検証のために平文が必要（HMAC）なので、ハッシュではなく AES-256-GCM で
 * 暗号化して DB に保持する。暗号鍵は環境変数 MERCHANT_API_SECRET_ENC_KEY
 * （32バイトを base64 化した値）から読み、コードにもDBにも置かない。
 *
 * 暗号文の形式: "v1:<iv base64>:<tag base64>:<ciphertext base64>"
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENC_KEY_ENV = "MERCHANT_API_SECRET_ENC_KEY";
const FORMAT_VERSION = "v1";

/**
 * 暗号鍵を環境変数から読む。32バイトでなければ例外（切り詰め・貼り間違いの早期検知）。
 */
export function loadEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env[ENC_KEY_ENV];
  if (!raw) throw new Error(`${ENC_KEY_ENV} が設定されていません`);
  const key = Buffer.from(raw.replace(/\s+/g, ""), "base64");
  if (key.length !== 32) {
    throw new Error(`${ENC_KEY_ENV} はbase64デコード後32バイトである必要があります（実際: ${key.length}バイト）`);
  }
  return key;
}

/**
 * 加盟店へ渡す署名鍵を生成する（32バイト乱数・base64url）。
 *
 * @param environment - 接頭辞で環境を区別する（取り違え防止）
 */
export function generateMerchantSecret(environment: "test" | "production"): string {
  const prefix = environment === "test" ? "sk_test_" : "sk_live_";
  return prefix + randomBytes(32).toString("base64url");
}

/**
 * 署名鍵を暗号化する。
 *
 * @param plain - 署名鍵（平文）
 * @param key - 32バイトの暗号鍵（省略時は環境変数）
 */
export function encryptSecret(plain: string, key: Buffer = loadEncryptionKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(":");
}

/**
 * 暗号文を復号する。改ざん・鍵違いは例外になる（GCMの認証タグで検知）。
 *
 * @param enc - encryptSecret の出力
 * @param key - 32バイトの暗号鍵（省略時は環境変数）
 */
export function decryptSecret(enc: string, key: Buffer = loadEncryptionKey()): string {
  const parts = enc.split(":");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new Error("署名鍵の暗号文の形式が不正です");
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64")), decipher.final()]).toString("utf8");
}
