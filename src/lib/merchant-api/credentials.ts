/**
 * 加盟店API の資格情報（merchant_id / 署名鍵）の発行・再発行
 *
 * 署名鍵の平文は発行時に一度だけ返し、DB には暗号文と末尾4文字のみ保存する。
 */
import { z } from "zod";
import { newApiMerchantId } from "./ids";
import { encryptSecret, generateMerchantSecret } from "./secret";
import type { MerchantApiEnvironment } from "./types";

/** 旧鍵を受け付ける期間（接続仕様書 第3章: 再発行から24時間） */
export const PREVIOUS_SECRET_GRACE_MS = 24 * 60 * 60 * 1000;

const hostnameSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .refine((v) => /^(\*\.)?([a-z0-9-]+\.)+[a-z]{2,}$/.test(v), "ドメインの形式が不正です（例: ainylive.com）");

/** 発行時の入力 */
export const issueCredentialSchema = z.object({
  merchantId: z.string().uuid(),
  environment: z.enum(["test", "production"]),
  allowedDomains: z.array(hostnameSchema).min(1),
  webhookUrl: z.string().url().nullable(),
  maxEventMonths: z.number().int().min(1).max(12).default(3),
  amountLimitPerPayment: z.number().int().min(1).max(9_999_999).nullable().default(null),
  maxExpiresIn: z.number().int().min(300).max(5_184_000).default(3600),
});

export type IssueCredentialInput = z.input<typeof issueCredentialSchema>;

/**
 * 通知先URLが https で、届出ドメインに含まれるか。
 */
export function isValidWebhookUrl(url: string, allowedDomains: string[]): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" || u.username || u.password) return false;
  const host = u.hostname.toLowerCase();
  return allowedDomains.some((d) => (d.startsWith("*.") ? host.endsWith(d.slice(1)) : host === d));
}

/** 発行結果（secret は表示用。保存しないこと） */
export interface IssuedCredential {
  row: {
    merchant_id: string;
    environment: MerchantApiEnvironment;
    api_merchant_id: string;
    secret_enc: string;
    secret_last4: string;
    allowed_domains: string[];
    webhook_url: string | null;
    max_event_months: number;
    amount_limit_per_payment: number | null;
    max_expires_in: number;
  };
  apiMerchantId: string;
  secret: string;
}

/**
 * 資格情報の行を作る（DB への保存は呼び出し側）。
 *
 * @param key - 暗号鍵（省略時は環境変数 MERCHANT_API_SECRET_ENC_KEY）
 * @throws 入力不正（通知先が届出ドメイン外など）
 */
export function buildCredential(raw: IssueCredentialInput, key?: Buffer): IssuedCredential {
  const input = issueCredentialSchema.parse(raw);
  if (input.webhookUrl && !isValidWebhookUrl(input.webhookUrl, input.allowedDomains)) {
    throw new Error("通知先URLは https で、届出ドメインに含まれている必要があります");
  }
  const apiMerchantId = newApiMerchantId(input.environment);
  const secret = generateMerchantSecret(input.environment);
  return {
    apiMerchantId,
    secret,
    row: {
      merchant_id: input.merchantId,
      environment: input.environment,
      api_merchant_id: apiMerchantId,
      secret_enc: encryptSecret(secret, key),
      secret_last4: secret.slice(-4),
      allowed_domains: input.allowedDomains,
      webhook_url: input.webhookUrl,
      max_event_months: input.maxEventMonths,
      amount_limit_per_payment: input.amountLimitPerPayment,
      max_expires_in: input.maxExpiresIn,
    },
  };
}

/**
 * 署名鍵の再発行。現行鍵を旧鍵として24時間残す更新内容を返す。
 */
export function buildRotation(
  current: { secret_enc: string },
  environment: MerchantApiEnvironment,
  now: Date,
  key?: Buffer
): { patch: Record<string, string>; secret: string } {
  const secret = generateMerchantSecret(environment);
  return {
    secret,
    patch: {
      previous_secret_enc: current.secret_enc,
      previous_secret_expires_at: new Date(now.getTime() + PREVIOUS_SECRET_GRACE_MS).toISOString(),
      secret_enc: encryptSecret(secret, key),
      secret_last4: secret.slice(-4),
    },
  };
}
