import { test } from "@playwright/test";
import { login, expect } from "../helpers";

test.describe("アクセス制御（middleware）", () => {
  test("未認証で保護ルートへアクセスすると /login へリダイレクト", async ({ page }) => {
    await page.goto("/admin/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("未認証で /facility/residents もログインへ", async ({ page }) => {
    await page.goto("/facility/residents");
    await expect(page).toHaveURL(/\/login/);
  });

  test("ロール不一致のポータルは 403", async ({ page }) => {
    // family でログイン → /admin へアクセスすると 403
    await login(page, "family");
    const res = await page.goto("/admin/dashboard");
    expect(res?.status()).toBe(403);
  });

  test("公開ページ /login は未認証で表示できる", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "QOLC ログイン" })).toBeVisible();
  });
});
