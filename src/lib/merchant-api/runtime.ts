/**
 * 本番用の依存一式を組み立てる（Route Handler から使う）
 */
import type { MerchantApiDeps } from "./deps";
import { decryptSecret } from "./secret";
import { createSupabaseMerchantApiStore } from "./supabase-store";
import { usenPay, usenSearchTrade, usenTokenInit } from "./usen-gateway";
import { resolveUsenProfile } from "./usen-profile";
import type { CredentialRow } from "./types";

/**
 * 資格情報の有効な署名鍵を返す。先頭が現行鍵。再発行後の猶予期間中は旧鍵も含む。
 *
 * @param now - 旧鍵の期限判定に使う現在時刻
 */
export function credentialSecrets(credential: CredentialRow, now: Date, key?: Buffer): string[] {
  const secrets = [decryptSecret(credential.secret_enc, key)];
  if (
    credential.previous_secret_enc &&
    credential.previous_secret_expires_at &&
    new Date(credential.previous_secret_expires_at) > now
  ) {
    secrets.push(decryptSecret(credential.previous_secret_enc, key));
  }
  return secrets;
}

/**
 * 実環境の依存（Supabase・USEN・環境変数）を作る。
 */
export function createMerchantApiDeps(): MerchantApiDeps {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    store: createSupabaseMerchantApiStore(),
    usen: {
      tokenInit: (profile, input) => usenTokenInit(profile, input),
      pay: (profile, input) => usenPay(profile, input),
      searchTrade: (profile, jutyuCd) => usenSearchTrade(profile, jutyuCd),
    },
    resolveProfile: (environment, mallCode) => resolveUsenProfile(environment, mallCode),
    secretsOf: (credential) => credentialSecrets(credential, new Date()),
    now: () => new Date(),
    appUrl,
  };
}
