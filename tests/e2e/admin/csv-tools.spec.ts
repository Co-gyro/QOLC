import path from "node:path";
import { test, expect } from "@playwright/test";
import { login } from "../helpers";

/**
 * JCB CSV変換: 売上明細(UR)＋振込情報(FI) を投入 →
 * UR(リネーム)・FI/FM(共通フォーマット)を生成。支払先番号固定・締日自動算出。
 */
const DATA_DIR = path.resolve(__dirname, "../../../test-data");
const FILES = [
  path.join(DATA_DIR, "JCB_売上明細CSV_ダミー.csv"),
  path.join(DATA_DIR, "JCB_振込情報CSV_ダミー.csv"),
];

test("JCBダミーから UR/FI/FM(共通) を生成できる", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/csv-tools");

  await page.locator('input[type="file"]').setInputFiles(FILES);

  // 売上明細(UR)・振込情報(FI)と判別される
  await expect(page.getByText(/売上明細\(UR\)/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/振込情報\(FI\)/).first()).toBeVisible();

  // 支払先番号は156742401で固定
  await expect(page.locator("#jcb-payee")).toHaveValue("156742401");

  await page.getByRole("button", { name: "変換を生成" }).click();

  // UR / FI / FM が出力される（締日2026/03/15＝15日締めで算出）
  await expect(page.getByText("生成結果", { exact: false })).toBeVisible();
  await expect(page.locator("text=JCB_UR_20260315_156742401.csv").first()).toBeVisible();
  await expect(page.locator("text=JCB_FI_20260315_156742401.csv").first()).toBeVisible();
  await expect(page.locator("text=JCB_FM_20260315_156742401.csv").first()).toBeVisible();
});
