import { test } from "@playwright/test";
import { login, expect } from "../helpers";

/**
 * 施設ポータルでの入居者 登録→一覧確認→削除 の一連フロー。
 * ユニークな被保険者番号を使い、テスト末尾で削除して後始末する。
 */
test("施設: 入居者の登録と削除", async ({ page }) => {
  // 一意な10桁の被保険者番号
  const ins = "9" + (Date.now() % 1_000_000_000).toString().padStart(9, "0");
  const last = "E2E";
  const first = ins.slice(-4);

  await login(page, "facility");
  await page.goto("/facility/residents");
  await expect(page.getByRole("heading", { name: "入居者管理" })).toBeVisible();

  // 登録
  await page.getByRole("button", { name: "入居者を登録", exact: false }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("#r-last").fill(last);
  await dialog.locator("#r-first").fill(first);
  await dialog.locator("#r-ins").fill(ins);
  await dialog.getByRole("button", { name: "登録", exact: true }).click();

  // 一覧に表示される
  await expect(page.locator(`text=${ins}`)).toBeVisible({ timeout: 15_000 });

  // 削除（該当行の削除ボタン → 確認ダイアログ）
  const row = page.getByRole("row").filter({ hasText: ins });
  await row.getByRole("button", { name: "削除" }).click();
  const confirm = page.getByRole("dialog");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "削除する" }).click();

  // 一覧から消える
  await expect(page.locator(`text=${ins}`)).toHaveCount(0, { timeout: 15_000 });
});
