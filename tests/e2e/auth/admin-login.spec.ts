import { test, expect } from "@playwright/test";

/**
 * 管理者ログイン → ダッシュボード表示
 *
 * 注: 実運用前にテスト用 admin アカウントの seed が必要。
 *     ローカル動作確認のため一旦 skip。
 */
test.skip("管理者ログイン後 /admin/dashboard へ遷移", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(process.env.E2E_ADMIN_EMAIL ?? "admin@qolc.test");
  await page.getByLabel("パスワード").fill(process.env.E2E_ADMIN_PASSWORD ?? "test-password");
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
});
