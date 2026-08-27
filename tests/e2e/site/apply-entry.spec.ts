import { test, expect } from "@playwright/test";

/**
 * 加盟店申請の2つの入口（介護施設向け / 一般の店舗・事業所向け）のE2E。
 *
 * 介護以外のお客様が「介護」「施設」の語に違和感を持つ問題への対応なので、
 * 一般向けフォームの本文に該当語が出ないことをここで固定する。
 * 紹介サイトは `/site/*` セグメント実装（本番は qolc.jp で rewrite）。
 */
test.describe("加盟店申請の入口", () => {
  test("区分未指定なら選択画面が出る", async ({ page }) => {
    await page.goto("/site/apply");
    await expect(page.getByRole("heading", { name: "加盟店申請" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /介護施設向け（QOLC）/ })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /一般の店舗・事業所向け/ })
    ).toBeVisible();
  });

  test("一般向けを選ぶと店舗・事業所の表記になり、本文に介護・施設が出ない", async ({
    page,
  }) => {
    await page.goto("/site/apply");
    await page.getByRole("button", { name: /一般の店舗・事業所向け/ }).click();

    await expect(page.getByText("店舗・事業所情報")).toBeVisible();
    // ラベルは「店舗・事業所名 必須」のように必須バッジを内包するため要素で絞る
    await expect(
      page.locator(".apply-form-label", { hasText: "店舗・事業所名" }).first()
    ).toBeVisible();

    // 本文（ヘッダー・フッターを除くフォーム領域）に「介護」「施設」が無いこと。
    // 「介護施設向けの申請はこちら」の切替ボタンだけは意図的に残す。
    const flow = page.locator(".apply-flow");
    await expect(flow).not.toContainText("介護");
    await expect(flow).not.toContainText("施設");
    const form = page.locator(".apply-form");
    await expect(form).not.toContainText("介護");
    await expect(form).not.toContainText("施設");
  });

  test("?type=general の直リンクで一般向けフォームに直接入れる", async ({ page }) => {
    await page.goto("/site/apply?type=general");
    await expect(page.getByText("店舗・事業所情報")).toBeVisible();
  });

  test("?type=care の直リンクで介護施設向けフォームに直接入れる", async ({ page }) => {
    await page.goto("/site/apply?type=care");
    await expect(
      page.getByRole("heading", { name: "加盟店申請（介護施設向け）" })
    ).toBeVisible();
    await expect(page.getByText("施設情報", { exact: true })).toBeVisible();
  });

  test("フォーム上部のリンクでもう一方の入口へ切り替えられる", async ({ page }) => {
    await page.goto("/site/apply?type=care");
    await page
      .getByRole("button", { name: /一般の店舗・事業所向けの申請はこちら/ })
      .click();
    await expect(page.getByText("店舗・事業所情報")).toBeVisible();
    await expect(page).toHaveURL(/type=general/);
  });
});
