/**
 * テスト用環境変数セットアップヘルパー
 *
 * テストファイル冒頭で setupTestEnv() を呼ぶと、決済関連の必須環境変数が仮設定される。
 */
import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tmpKeyPath: string | null = null;

/** 64バイトのテスト用HMAC鍵 */
export const TEST_HMAC_KEY = Buffer.from(
  Array.from({ length: 64 }, (_, i) => i)
);

export function setupTestEnv(): void {
  if (!tmpKeyPath) {
    tmpKeyPath = join(tmpdir(), `qolc-test-key-${process.pid}.NMK`);
    writeFileSync(tmpKeyPath, TEST_HMAC_KEY);
  }
  process.env.USEN_HMAC_KEY_PATH = tmpKeyPath;
  process.env.USEN_SITE_CD = process.env.USEN_SITE_CD ?? "TSJL";
  process.env.USEN_MALL_CD = process.env.USEN_MALL_CD ?? "TSJM";
  process.env.USEN_API_BASE_URL =
    process.env.USEN_API_BASE_URL ?? "https://test.usen.example/payment";
  process.env.USEN_TOKEN_API_BASE_URL =
    process.env.USEN_TOKEN_API_BASE_URL ??
    "https://test.usen.example/ec-payment-uhup";
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "anon-test-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "service-test-key";
}

export function teardownTestEnv(): void {
  if (tmpKeyPath) {
    try {
      unlinkSync(tmpKeyPath);
    } catch {
      // ignore
    }
    tmpKeyPath = null;
  }
}
