/**
 * 加盟店申請の申請書作成動線（JCB・セゾン統一動線）のE2E
 *
 * 案件詳細③の「申請書を作成（JCB・セゾン）」→ 作成画面（JCBタブ／セゾンタブ）まで、
 * 実画面にボタン・案内が見えることを検証する（動線が消える回帰を防ぐ）。
 */
import { test, expect } from "@playwright/test";
import { login } from "../helpers";

test.describe("申請書作成の動線（JCB・セゾン統一）", () => {
  test("案件詳細③→作成画面→セゾンタブでダウンロード動線が見える", async ({ page }) => {
    await login(page, "admin");

    // 加盟店申請の一覧から先頭の案件を開く（テーブル行クリックで詳細へ）
    await page.goto("/admin/applications");
    await expect(page.getByRole("heading", { name: "加盟店申請・登録" })).toBeVisible();
    const firstRow = page.locator("tbody tr").first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await firstRow.click();
    await page.waitForURL("**/admin/applications/*", { timeout: 30_000 });

    // ③カードに申請書作成ボタン（JCB・セゾン共通動線）が見える
    const createLink = page.getByRole("link", { name: "申請書を作成（JCB・セゾン）" });
    await expect(createLink).toBeVisible({ timeout: 30_000 });

    // 作成画面へ遷移し、JCB・セゾン両タブが存在する
    await createLink.click();
    await page.waitForURL("**/admin/merchant-application*", { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "申請書の作成" })).toBeVisible();
    await expect(page.getByRole("tab", { name: /JCB/ })).toBeVisible();

    // セゾンタブ: ダウンロードボタンが常に見える（不足時は無効化＋理由表示）
    await page.getByRole("tab", { name: "セゾン" }).click();
    const saisonBtn = page.getByRole("button", { name: "セゾン申込書（Excel）をダウンロード" });
    await expect(saisonBtn).toBeVisible({ timeout: 30_000 });
    // 案件詳細へ戻る導線もある
    await expect(
      page.getByRole("link", { name: /案件詳細へ戻る/ })
    ).toBeVisible();
  });

  test("案件を指定せず開いたセゾンタブは案内が出る", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/merchant-application");
    await page.getByRole("tab", { name: "セゾン" }).click();
    await expect(
      page.getByText("案件を選んでからこの画面を開いてください")
    ).toBeVisible({ timeout: 30_000 });
  });
});
