import path from "node:path";
import { test, expect } from "@playwright/test";
import { login } from "../helpers";

const DATA = path.resolve(__dirname, "../../../test-data");
const CSV = path.join(DATA, "セゾン_売上データCSV_ダミー.csv");
const PDF = path.join(DATA, "セゾン_支払計算書PDF_0315締め_ダミー.pdf");

/**
 * セゾンCSV変換の一括ツール: CSV+PDFを1回アップ→UR/FM/FIをまとめて生成。
 */
test("CSV+PDFを1回アップして UR/FM/FI をまとめて生成できる", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/csv-tools");

  // セゾンタブへ
  await page.getByRole("tab", { name: "セゾン" }).click();

  await page.locator('input[accept*="csv"]').setInputFiles(CSV);
  await page.locator('input[accept*="pdf"]').setInputFiles(PDF);

  // CSVパース完了（行数表示）とPDF解析完了（締:表示）を待つ
  await expect(page.getByText(/\d+行/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/締: /).first()).toBeVisible({ timeout: 30_000 });

  // 支払先番号は加盟店No.(1234567)がCSVから自動補完される
  await expect(page.locator("#saison-payee")).toHaveValue("1234567");

  await page.getByRole("button", { name: "変換を生成" }).click();

  // 生成結果に UR / FM / FI が並ぶ
  await expect(page.getByText("生成結果", { exact: false })).toBeVisible();
  await expect(page.locator("text=SAISON_UR_").first()).toBeVisible();
  await expect(page.locator("text=SAISON_FM_").first()).toBeVisible();
  await expect(page.locator("text=SAISON_FI_").first()).toBeVisible();
});
