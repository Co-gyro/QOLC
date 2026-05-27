import { test } from "@playwright/test";
import { login, logout, USERS, expect } from "../helpers";

test.describe("ログイン/ログアウト", () => {
  test("管理者がログインしてダッシュボードに遷移", async ({ page }) => {
    await login(page, "admin");
    await expect(page.getByRole("heading", { name: USERS.admin.heading })).toBeVisible();
  });

  test("家族がログインしてユーザーホームに遷移", async ({ page }) => {
    await login(page, "family");
    await expect(page).toHaveURL(/\/user\/home/);
  });

  test("誤ったパスワードはエラー表示（遷移しない）", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("メールアドレス").fill(USERS.admin.email);
    await page.getByLabel("パスワード").fill("WrongPassword#0000");
    await page.getByRole("button", { name: "ログイン", exact: false }).click();
    // /login に留まり、エラーメッセージが出る
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("text=/失敗|Invalid|エラー|credentials/i").first()).toBeVisible({ timeout: 15_000 });
  });

  test("ログアウトでログイン画面に戻る", async ({ page }) => {
    await login(page, "admin");
    await logout(page);
    await expect(page).toHaveURL(/\/login/);
  });
});
