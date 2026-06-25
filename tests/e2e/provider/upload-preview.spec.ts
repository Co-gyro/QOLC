import { test } from "@playwright/test";
import { resolve } from "node:path";
import { login, expect } from "../helpers";

/**
 * 提供者ポータル: 明細アップロード → マッチングプレビュー の一連フロー。
 *
 * ⚠️ 重要: 「決済を実行」ボタンは USEN PSP に与信・売上計上を行い、
 * 本番環境では実カードに課金される。E2Eでは**絶対にクリックしない**。
 * 本テストはプレビュー（被保険者番号マッチング・読み取り専用）までを検証する。
 *
 * 前提: テスト環境のシード入居者（山田テスト=0000000001 等）が存在すること。
 * sample CSV: test-data/sample-upload-provider.csv（登録済み3件＋未登録1件）。
 */
// Playwrightはプロジェクトルートから実行されるため cwd 基準で解決
const SAMPLE_CSV = resolve(process.cwd(), "test-data/sample-upload-provider.csv");

test("提供者: 明細アップロードでマッチングプレビューが表示される（決済は実行しない）", async ({
  page,
}) => {
  await login(page, "provider");
  await page.goto("/provider/upload");
  await expect(page.getByRole("heading", { name: "明細アップロード" })).toBeVisible();

  // 隠しファイル入力にサンプルCSVを投入
  await page.locator('input[type="file"]').setInputFiles(SAMPLE_CSV);

  // プレビューカードが表示される（マッチ件数・合計を含むタイトル）
  const previewTitle = page.getByText(/プレビュー（マッチ\s*\d+名/);
  await expect(previewTitle).toBeVisible({ timeout: 30_000 });

  // マッチした入居者に対して「決済を実行」ボタンが活性で出る（matched > 0 の証跡）
  const executeBtn = page.getByRole("button", { name: /決済を実行/ });
  await expect(executeBtn).toBeVisible();
  await expect(executeBtn).toBeEnabled();

  // 未登録の被保険者番号(12345678)が未マッチとして提示される
  await expect(page.getByText(/12345678/)).toBeVisible();

  // バッチIDが採番されている（プレビュー段階でバッチは作成される）
  await expect(page.getByText(/バッチID:/)).toBeVisible();

  // ── ここで終了。決済実行（USEN課金）は行わない ──
});
