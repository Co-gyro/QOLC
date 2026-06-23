import { test, expect } from "@playwright/test";
import { login } from "../helpers";

/** 操作ログ画面（運営／施設）が役割で開けることを検証。 */
test("運営(admin)が操作ログを開ける", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/logs");
  await expect(page.getByRole("heading", { name: "操作ログ" })).toBeVisible();
  // 絞り込みUI（操作の種類セレクト・表示ボタン）が出る
  await expect(page.locator("#log-action")).toBeVisible();
  await expect(page.getByRole("button", { name: "表示" })).toBeVisible();
  // ログ一覧 or 空表示のいずれかが描画される（読込完了を待つ）
  await expect(page.getByText(/件（最新500件まで）|ログがありません/).first()).toBeVisible({ timeout: 30_000 });
});

test("施設(facility_staff)が操作ログを開ける", async ({ page }) => {
  await login(page, "facility");
  await page.goto("/facility/logs");
  await expect(page.getByRole("heading", { name: "操作ログ" })).toBeVisible();
  await expect(page.locator("#log-action")).toBeVisible();
});
