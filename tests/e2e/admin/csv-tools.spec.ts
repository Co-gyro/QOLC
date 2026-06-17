import path from "node:path";
import { test, expect } from "@playwright/test";
import { login } from "../helpers";

/**
 * セルフィッシュ取込テスト リハーサル（2026-06-16 藤本さん打合せ用）
 * admin ログイン → /admin/csv-tools → JCBダミー3点を変換 → 命名規則・ZIP出力を検証。
 */
const DATA_DIR = path.resolve(__dirname, "../../../test-data");
const FILES = [
  path.join(DATA_DIR, "JCB_売上明細CSV_ダミー.csv"),
  path.join(DATA_DIR, "JCB_振込情報CSV_ダミー.csv"),
  path.join(DATA_DIR, "JCB_振込明細CSV_ダミー.csv"),
];

test("JCBダミー3点を変換しセルフィッシュ命名規則で出力できる", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/csv-tools");

  // 締日・支払先番号を入力
  await page.getByLabel("締日").fill("2026-03-31");
  await page.getByLabel(/支払先番号/).fill("156742401");

  // 隠しファイル input に3ファイルを投入
  await page.locator('input[type="file"]').setInputFiles(FILES);

  // 種別が UR/FI/FM と自動判別される
  await expect(page.getByText("売上明細 (UR)")).toBeVisible();
  await expect(page.getByText("振込情報 (FI)")).toBeVisible();
  await expect(page.getByText("振込明細 (FM)")).toBeVisible();

  // リネーム後ファイル名が表示される
  await expect(page.getByText("JCB_UR_20260331_156742401.csv")).toBeVisible();
  await expect(page.getByText("JCB_FI_20260331_156742401.csv")).toBeVisible();
  await expect(page.getByText("JCB_FM_20260331_156742401.csv")).toBeVisible();

  // 個別ダウンロード（UR）が実ファイルとして落ちる
  const dl1 = page.waitForEvent("download");
  await page.getByRole("button", { name: "ダウンロード" }).first().click();
  const urFile = await dl1;
  expect(urFile.suggestedFilename()).toBe("JCB_UR_20260331_156742401.csv");

  // まとめてZIPダウンロード
  const dl2 = page.waitForEvent("download");
  await page.getByRole("button", { name: /ZIPダウンロード/ }).click();
  const zip = await dl2;
  expect(zip.suggestedFilename()).toBe("JCB_20260331.zip");
});
