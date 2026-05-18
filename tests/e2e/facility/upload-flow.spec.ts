import { test, expect } from "@playwright/test";

test.skip("施設スタッフが明細CSVをアップロードしてプレビュー確認", async ({ page }) => {
  await page.goto("/facility/statements");
  // アップロードボタンクリック
  await page.getByRole("button", { name: "明細をアップロード" }).click();
  // ファイル選択
  await page
    .getByLabel("CSVファイル")
    .setInputFiles("tests/fixtures/csv-samples/sample.csv");
  // プレビュー表示
  await expect(page.getByText("プレビュー")).toBeVisible();
});
