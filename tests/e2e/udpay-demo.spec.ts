import { expect, test } from "@playwright/test";

/**
 * UD Payment（仮）デモのゴールデンパスE2E。
 * 前月コピー → 交通費修正 → 確定（メール送付・課金予約）→ 課金バッチ →
 * 与信落ち → 再決済 → 領収書、および顧客のカード登録リンクの動線を通しで検証する。
 * 認証不要・外部決済への接続なし（ファイルストアのデモデータのみ）。
 */

const SCREEN_DIR = "test-results/udpay-screens";

test.describe.serial("UD Payment デモ", () => {
  test.beforeAll(async ({ request }) => {
    const res = await request.post("/api/udpay", {
      data: { action: "resetDemo" },
    });
    expect(res.ok()).toBeTruthy();
  });

  test("ダッシュボードにデモデータのサマリが表示される", async ({ page }) => {
    await page.goto("/udpay");
    await expect(page.getByRole("heading", { name: "ダッシュボード" })).toBeVisible();
    await expect(page.getByText("6件").first()).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/01-dashboard.png`, fullPage: true });
  });

  test("前月コピー → 交通費修正 → 確定でメール送付と課金予約が行われる", async ({
    page,
  }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/udpay/invoices");
    await page
      .getByRole("button", { name: "前月分をコピーして下書き作成" })
      .click();
    await expect(page.getByText("下書きが5件あります")).toBeVisible();

    // うみかぜ歯科医院（交通費が毎月変わる顧客）の下書きを開く
    await page
      .locator("tr", { hasText: "うみかぜ歯科医院" })
      .getByRole("link", { name: "編集・確定" })
      .click();
    await expect(
      page.getByRole("heading", { name: /うみかぜ歯科医院/ }),
    ).toBeVisible();

    // 交通費の単価を当月実費（89,500円）に修正する
    // （摘要は input の value のため hasText では拾えない。行番号で対応づける）
    const descInputs = page.getByLabel("摘要");
    await expect(descInputs.first()).toBeVisible();
    const count = await descInputs.count();
    let kotsuhiIndex = -1;
    for (let i = 0; i < count; i++) {
      if ((await descInputs.nth(i).inputValue()).includes("交通費")) {
        kotsuhiIndex = i;
        break;
      }
    }
    expect(kotsuhiIndex).toBeGreaterThanOrEqual(0);
    await page.getByLabel("単価").nth(kotsuhiIndex).fill("89500");
    await expect(page.getByText("合計 ¥296,120（税込）")).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/02-invoice-edit.png`, fullPage: true });

    await page
      .getByRole("button", { name: "確定してメール送付・課金予約" })
      .click();

    // 確定後: メールプレビューと課金予約（宮里先生=毎月25日→8/25）が表示される
    await expect(page.getByText("送付済みの請求明細メール")).toBeVisible();
    await expect(page.getByText("2026年8月25日に自動決済")).toBeVisible();
    await expect(page.getByText("課金予約中")).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/03-invoice-confirmed.png`, fullPage: true });
  });

  test("残りの下書きも確定できる", async ({ page }) => {
    await page.goto("/udpay/invoices");
    // 下書きが残っている間、先頭の「編集・確定」を開いて確定する
    for (let i = 0; i < 4; i++) {
      const editLink = page.getByRole("link", { name: "編集・確定" }).first();
      await editLink.click();
      await page
        .getByRole("button", { name: "確定してメール送付・課金予約" })
        .click();
      await expect(page.getByText("送付済みの請求明細メール")).toBeVisible();
      await page.goto("/udpay/invoices");
    }
    await expect(page.getByRole("link", { name: "編集・確定" })).toHaveCount(0);
  });

  test("課金バッチ → 与信落ち → 再決済 → 領収書の流れが動く", async ({ page }) => {
    page.on("dialog", (d) => d.accept());
    await page.goto("/udpay/payments");
    await page.getByRole("button", { name: /課金バッチを実行/ }).click();

    // みなと歯科医院が do_not_honor で与信落ちする
    await expect(page.getByText(/与信落ちが1件あります/)).toBeVisible();
    const failedRow = page.locator("tr", { hasText: "みなと歯科医院" }).first();
    await expect(failedRow.getByText("与信落ち")).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/04-payments-failed.png`, fullPage: true });

    // 再決済で入金済みになる
    await failedRow.getByRole("button", { name: "再決済" }).click();
    await expect(page.getByText(/与信落ちが1件あります/)).toHaveCount(0);
    await expect(failedRow.getByText("入金済み")).toBeVisible();

    // 領収書を表示する
    await failedRow.getByRole("link", { name: "領収書" }).click();
    await expect(page.getByRole("heading", { name: "領収書" })).toBeVisible();
    await expect(page.getByText("みなと歯科医院 御中")).toBeVisible();
    await expect(page.getByText(/クレジットカード（JCB/)).toBeVisible();
    await page.screenshot({ path: `${SCREEN_DIR}/05-receipt.png`, fullPage: true });
  });

  test("顧客がカード登録リンクからカードを登録できる", async ({ page }) => {
    // わかば歯科（カード未登録の新規顧客）の登録リンクを開く
    await page.goto("/udpay/card/demo-wakaba");
    await expect(page.getByText("わかば歯科 伊藤先生")).toBeVisible();
    await page.getByLabel("カード番号").fill("4242 4242 4242 4242");
    await page.getByLabel("有効期限（MM/YY）").fill("12/28");
    await page.getByLabel("セキュリティコード").fill("123");
    await page.screenshot({ path: `${SCREEN_DIR}/06-card-register.png`, fullPage: true });
    await page.getByRole("button", { name: "このカードを登録する" }).click();
    await expect(page.getByText("カードの登録が完了しました")).toBeVisible();

    // 顧客管理画面に登録済みとして反映される
    await page.goto("/udpay/customers");
    const wakabaRow = page.locator("tr", { hasText: "わかば歯科" });
    await expect(wakabaRow.getByText("登録済み")).toBeVisible();
    await expect(wakabaRow.getByText(/Visa/)).toBeVisible();
  });
});
