import { test } from "@playwright/test";
import { resolve } from "node:path";
import { login, expect } from "../helpers";

/**
 * 施設ポータル: 明細アップロード（施設代行）のE2E。
 *
 * ⚠️ 重要: 「決済を実行」ボタンは USEN PSP に与信・売上計上を行い、本番では実カードに
 * 課金される。E2Eでは**絶対にクリックしない**。アップロード〜プレビューまでを検証。
 *
 * 前提（テスト環境シード）:
 *   - 施設「テスト介護施設」は提供者「テスト診療所」と提携済み
 *   - 明細CSV: test-data/sample-upload-provider.csv（鈴木¥3,000・佐藤¥8,000がマッチ）
 */
const SAMPLE_CSV = resolve(process.cwd(), "test-data/sample-upload-provider.csv");

test("施設: 明細管理からアップロード画面へ遷移できる（Forbiddenにならない）", async ({ page }) => {
  await login(page, "facility");
  await page.goto("/facility/statements");
  await page.getByRole("link", { name: "アップロード画面へ" }).click();

  // 提供者ポータルではなく施設内のアップロード画面に遷移する
  await page.waitForURL("**/facility/upload");
  await expect(page.getByRole("heading", { name: "明細アップロード" })).toBeVisible();
});

test("施設: 提供者を選んで明細をアップロードするとプレビューが表示される（決済は実行しない）", async ({
  page,
}) => {
  await login(page, "facility");
  await page.goto("/facility/upload");
  await expect(page.getByRole("heading", { name: "明細アップロード" })).toBeVisible();

  // 提携提供者のセレクトが出る（1件のみなら自動選択される）
  const select = page.getByLabel("対象の提供者");
  await expect(select).toBeVisible({ timeout: 30_000 });
  const selected = await select.inputValue();
  if (!selected) {
    await select.selectOption({ index: 1 });
  }

  // ①②の2枠が表示される
  await expect(page.getByText("明細・レセプト")).toBeVisible();
  await expect(page.getByText("その他費用（保険外）").first()).toBeVisible();

  // ①にサンプルCSVを投入 → プレビュー表示
  await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_CSV);
  await expect(page.getByText(/プレビュー（マッチ\s*\d+名/)).toBeVisible({ timeout: 30_000 });

  // マッチした入居者に「決済を実行」ボタンが出る（クリックはしない）
  await expect(page.getByRole("button", { name: /決済を実行/ })).toBeVisible();

  // ── 決済実行（USEN課金）は行わない ──
});
