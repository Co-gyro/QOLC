import { expect, test, type Page } from "@playwright/test";

/**
 * UD Payment（仮）デモのゴールデンパスE2E（2026-09-30 ランサイド様要望 1〜7 反映版）。
 * コピー → 交通費修正 → 課金予約（メール未送付）→ メール追記 → まとめて課金予約 →
 * 一括実行の確認画面（期限切れは対象外）→ 決済確定 → 取消 → 自動課金 → 与信落ち → 再決済 → 領収書、
 * CSV取込、顧客の絞り込み・カード登録（有効期限つき）を通しで検証する。
 * 認証不要・外部決済への接続なし（ファイルストアのデモデータのみ）。
 */

const SCREEN_DIR = "test-results/udpay-screens";

/** 指定した顧客名を含む表の行 */
function row(page: Page, name: string) {
  return page.locator("tbody tr", { hasText: name }).first();
}

test.describe.serial("UD Payment デモ", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/udpay", { data: { action: "resetDemo" } });
    expect(res.ok()).toBeTruthy();
  });

  test("ダッシュボードに「今日やること」が表示される", async ({ page }) => {
    await page.goto("/udpay");
    await expect(page.getByRole("heading", { name: "今日やること" })).toBeVisible();
    await expect(page.getByText("カード未登録の顧客")).toBeVisible();
    await expect(page.getByText("カードの有効期限が近い・切れた顧客")).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/01-dashboard.png`, fullPage: true });
  });

  test("コピー → 交通費修正 → 課金予約してもメールは送られない", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/udpay/invoices");
    await expect(page.getByRole("navigation", { name: "月の切り替え" })).toBeVisible();
    await page.getByRole("button", { name: "直近の請求からコピーして下書き作成" }).click();
    await expect(page.getByRole("button", { name: /表示中の下書き6件をまとめて課金予約/ })).toBeVisible();

    await row(page, "うみかぜ歯科医院").getByRole("link", { name: "編集" }).click();
    await expect(page.getByRole("heading", { name: /うみかぜ歯科医院/ })).toBeVisible();
    const descInputs = page.getByLabel("摘要");
    await expect(descInputs.first()).toBeVisible();
    let kotsuhiIndex = -1;
    for (let i = 0; i < (await descInputs.count()); i++) {
      if ((await descInputs.nth(i).inputValue()).includes("交通費")) kotsuhiIndex = i;
    }
    expect(kotsuhiIndex).toBeGreaterThanOrEqual(0);
    await page.getByLabel("単価").nth(kotsuhiIndex).fill("89500");
    await expect(page.getByText("合計 ¥296,120（税込）")).toBeVisible();
    await expect(page.getByText(/「課金予約」を押してもメールは送られません/)).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/02-invoice-edit.png`, fullPage: true });
    await page.getByRole("button", { name: "課金予約", exact: true }).click();

    await expect(page.getByRole("button", { name: "下書きに戻す" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "請求メールのプレビュー・編集" })).toBeVisible();
    await page.getByLabel(/追記コメント/).fill("今月の交通費は那覇往復1回分です。");
    await page.getByRole("button", { name: "メール内容を保存" }).click();
    await expect(page.getByText("保存しました")).toBeVisible();
    await expect(page.locator(".up-mail-body")).toContainText("今月の交通費は那覇往復1回分です。");
    await expect(page.locator(".up-mail-fixed")).toContainText("ご請求金額合計: ¥296,120（税込）");
    await page.screenshot({ path: `${SCREEN_DIR}/03-mail-preview.png`, fullPage: true });
  });

  test("残りの下書きをまとめて課金予約できる", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/udpay/invoices");
    await page.getByRole("button", { name: /表示中の下書き5件をまとめて課金予約/ }).click();
    await expect(page.getByRole("button", { name: /まとめて課金予約/ })).toHaveCount(0);
    await expect(row(page, "さくら歯科クリニック").getByText("課金予約", { exact: true })).toBeVisible();
  });

  test("一括実行の確認画面: 期限切れは対象外、チェックした請求だけ決済確定", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/udpay/payments/confirm");
    await expect(page.getByRole("heading", { name: "一括実行の確認" })).toBeVisible();
    await expect(row(page, "こだま歯科クリニック").getByText("対象外: カード期限切れ")).toBeVisible();
    await expect(page.getByText(/対象 5件・合計/)).toBeVisible();
    // あおば歯科を対象から外す
    await page.getByLabel("あおば歯科クリニックを対象にする").uncheck();
    await expect(page.getByText(/対象 4件・合計/)).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/04-confirm.png`, fullPage: true });
    await page.getByRole("button", { name: "メールを一括送信して決済確定する" }).click();

    await expect(page.getByText(/一括実行しました: 決済確定 4件/)).toBeVisible();
    await expect(row(page, "さくら歯科クリニック").getByText("決済確定", { exact: true })).toBeVisible();
    await expect(row(page, "あおば歯科クリニック").getByText("課金予約", { exact: true })).toBeVisible();
  });

  test("決済確定を取り消すと課金予約に戻る", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/udpay/payments");
    await row(page, "ひかり歯科").getByRole("button", { name: "決済確定を取り消す" }).click();
    await expect(row(page, "ひかり歯科").getByText("課金予約", { exact: true })).toBeVisible();
  });

  test("自動課金 → 与信落ち → 再決済 → 領収書", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/udpay/payments");
    await page.getByRole("button", { name: "自動課金をいま実行（デモ）" }).click();
    await expect(page.getByText(/与信落ちが1件あります/)).toBeVisible();
    const failedRow = row(page, "みなと歯科医院");
    await expect(failedRow.getByText("与信落ち", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/05-payments-failed.png`, fullPage: true });
    await failedRow.getByRole("button", { name: "再決済" }).click();
    await expect(page.getByText(/与信落ちが1件あります/)).toHaveCount(0);
    await expect(failedRow.getByText("入金済み", { exact: true })).toBeVisible();
    await failedRow.getByRole("link", { name: "領収書" }).click();
    await expect(page.getByRole("heading", { name: "領収書" })).toBeVisible();
    await expect(page.getByText("みなと歯科医院 御中")).toBeVisible();
  });

  test("CSV一括取込で下書き請求書を作成できる", async ({ page }) => {
    await page.goto("/udpay/invoices");
    await page.getByRole("button", { name: "CSVで一括作成" }).click();
    const csv = [
      "顧客名,摘要,数量,単価（税抜）",
      "わかば歯科,基本サポート料金,1,9900",
      "わかば歯科,初期設定サポート,1,30000",
    ].join("\r\n");
    await page.setInputFiles('input[type="file"]', {
      name: "import.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(`﻿${csv}`, "utf-8"),
    });
    await expect(page.getByText(/明細2行／顧客1件を読み込みました/)).toBeVisible();
    await page.getByRole("button", { name: /取込を実行/ }).click();
    await expect(page.getByText(/取込完了: 下書き作成 1件／更新 0件/)).toBeVisible();
    await page.getByRole("button", { name: "閉じる" }).click();
    const wakabaRow = row(page, "わかば歯科");
    await expect(wakabaRow.getByText("下書き", { exact: true })).toBeVisible();
    await expect(wakabaRow.getByText("¥43,890")).toBeVisible();
  });

  test("顧客の絞り込み（有効期限が近い）とカード登録（有効期限つき）", async ({ page }) => {
    await page.goto("/udpay/customers?card=expiring");
    await expect(row(page, "ひかり歯科").getByText("期限間近", { exact: true })).toBeVisible();
    await expect(page.getByText("さくら歯科クリニック")).toHaveCount(0);
    await page.screenshot({ path: `${SCREEN_DIR}/06-customers-expiring.png`, fullPage: true });

    await page.goto("/udpay/card/demo-wakaba");
    await expect(page.getByText("わかば歯科 伊藤先生")).toBeVisible();
    await expect(page.getByText(/株式会社ランサイドからのご請求を毎月お支払い/)).toBeVisible();
    await page.getByLabel("カード番号").fill("4242 4242 4242 4242");
    await page.getByLabel("有効期限（MM/YY）").fill("12/28");
    await page.getByLabel("セキュリティコード").fill("123");
    await page.screenshot({ path: `${SCREEN_DIR}/07-card-register.png`, fullPage: true });
    await page.getByRole("button", { name: "このカードを登録する" }).click();
    await expect(page.getByText("カードの登録が完了しました")).toBeVisible();

    await page.goto("/udpay/customers?q=わかば");
    const wakabaRow = row(page, "わかば歯科");
    await expect(wakabaRow.getByText(/有効期限 2028年12月/)).toBeVisible();
  });
});
