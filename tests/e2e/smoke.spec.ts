import { test } from "@playwright/test";
import { login, expect } from "./helpers";

/** 各ポータルの主要画面が認証後に表示できるスモークテスト */
test.describe("ポータル スモーク", () => {
  test("admin: 主要ページが開ける", async ({ page }) => {
    await login(page, "admin");
    for (const [path, heading] of [
      ["/admin/facilities", "介護施設管理"],
      ["/admin/merchants", "加盟店管理"],
      ["/admin/payments", "決済管理"],
      ["/admin/master", "マスタ管理"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("facility: 主要ページが開ける", async ({ page }) => {
    await login(page, "facility");
    for (const [path, heading] of [
      ["/facility/residents", "入居者管理"],
      ["/facility/payments", "決済状況"],
      ["/facility/providers", "サービス提供者"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("provider: 主要ページが開ける", async ({ page }) => {
    await login(page, "provider");
    for (const [path, heading] of [
      ["/provider/upload", "明細アップロード"],
      ["/provider/facilities", "取引先施設一覧"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("user: 主要ページが開ける", async ({ page }) => {
    await login(page, "family");
    for (const [path, heading] of [
      ["/user/statements", "ご利用明細"],
      ["/user/receipts", "領収書"],
      ["/user/card", "カード管理"],
    ] as const) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});
