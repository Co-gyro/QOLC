import { test } from "@playwright/test";
import { resolve } from "node:path";
import { login, expect } from "../helpers";

/**
 * 提供者ポータル: 明細アップロード → その他費用合算 → プレビュー → 履歴詳細 の回帰E2E。
 *
 * ⚠️ 重要: 「決済を実行」ボタンは USEN PSP に与信・売上計上を行い、本番では実カードに
 * 課金される。E2Eでは**絶対にクリックしない**。アップロード〜プレビュー（読み取り）までを検証。
 *
 * 前提（テスト環境シード）:
 *   - 入居者: 鈴木花子=0000005678 / 佐藤次郎=0000009999 / 山田テスト=0001325455
 *   - 明細CSV: test-data/sample-upload-provider.csv（鈴木¥3,000・佐藤¥8,000がマッチ）
 *   - その他費用CSV: test-data/sample-other-cost.csv（鈴木¥98,000・佐藤¥50,000・山田¥145,859）
 */
const SAMPLE_CSV = resolve(process.cwd(), "test-data/sample-upload-provider.csv");
const OTHER_COST_CSV = resolve(process.cwd(), "test-data/sample-other-cost.csv");

test("提供者: 明細アップロードでマッチングプレビューが表示される（決済は実行しない）", async ({
  page,
}) => {
  await login(page, "provider");
  await page.goto("/provider/upload");
  await expect(page.getByRole("heading", { name: "明細アップロード" })).toBeVisible();

  // ①明細・②その他費用の2枠が最初から表示される
  await expect(page.getByText("明細・レセプト")).toBeVisible();
  await expect(page.getByText("その他費用（保険外）").first()).toBeVisible();

  // ①の file 入力（先頭）にサンプルCSVを投入
  await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_CSV);

  // プレビューカードが表示される（マッチ件数・合計を含むタイトル）
  await expect(page.getByText(/プレビュー（マッチ\s*\d+名/)).toBeVisible({ timeout: 30_000 });

  // マッチした入居者に「決済を実行」ボタンが活性で出る（matched > 0 の証跡）
  const executeBtn = page.getByRole("button", { name: /決済を実行/ });
  await expect(executeBtn).toBeVisible();
  await expect(executeBtn).toBeEnabled();

  // 未登録の被保険者番号(12345678)が未マッチとして提示される
  await expect(page.getByText(/12345678/)).toBeVisible();

  // まとめID（バッチ）が採番されている
  await expect(page.getByText(/まとめID:/)).toBeVisible();

  // ── 決済実行（USEN課金）は行わない ──
});

test("提供者: その他費用を同じまとめに合算し、入居者の金額が増える", async ({ page }) => {
  await login(page, "provider");
  await page.goto("/provider/upload");

  // ① 明細をアップロード → 鈴木 花子 ¥3,000 がマッチ
  await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_CSV);
  await expect(page.getByText(/プレビュー（マッチ\s*\d+名/)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("li", { hasText: "鈴木 花子" })).toContainText("¥3,000");

  // ② その他費用CSVを投入（②の file 入力 = 2番目）。鈴木に¥98,000を合算
  await page.locator('input[type="file"]').nth(1).setInputFiles(OTHER_COST_CSV);

  // 合算後: 鈴木 花子 = 3,000 + 98,000 = ¥101,000
  await expect(page.locator("li", { hasText: "鈴木 花子" })).toContainText("¥101,000", {
    timeout: 30_000,
  });

  // ── 決済実行は行わない ──
});

test("提供者: アップロード履歴の行をクリックすると内訳モーダルが開く", async ({ page }) => {
  await login(page, "provider");
  await page.goto("/provider/upload");

  // 直近の取込みを1件作る（履歴に必ず行が出るように）
  await page.locator('input[type="file"]').first().setInputFiles(SAMPLE_CSV);
  await expect(page.getByText(/プレビュー（マッチ\s*\d+名/)).toBeVisible({ timeout: 30_000 });

  // 履歴セクションの最初のデータ行をクリック
  await expect(page.getByRole("heading", { name: "アップロード履歴" })).toBeVisible();
  const firstRow = page.locator("tbody tr").first();
  await expect(firstRow).toBeVisible({ timeout: 30_000 });
  await firstRow.click();

  // 詳細モーダルが開く
  await expect(page.getByRole("heading", { name: "アップロード内容" })).toBeVisible({
    timeout: 15_000,
  });
});
