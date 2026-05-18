import { test, expect } from "@playwright/test";

test.skip("未認証ユーザーが /admin にアクセスすると /login にリダイレクト", async ({ page }) => {
  await page.goto("/admin/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test.skip("family ロールが /admin にアクセスすると 403", async ({ page }) => {
  // 事前に family でログイン
  // ...
  const response = await page.goto("/admin/dashboard");
  expect(response?.status()).toBe(403);
});
