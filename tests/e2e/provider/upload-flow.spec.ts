import { test, expect } from "@playwright/test";

test.skip("提供者の一括アップロード → 施設横断マッチング → プレビュー", async ({ page }) => {
  await page.goto("/provider/upload");
  await page
    .getByLabel("CSVファイル")
    .setInputFiles("tests/fixtures/csv-samples/multi-facility.csv");
  await expect(page.getByText("〇〇介護施設")).toBeVisible();
  await expect(page.getByText("△△ケアホーム")).toBeVisible();
});
