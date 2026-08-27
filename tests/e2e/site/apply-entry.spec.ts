import { test, expect } from "@playwright/test";

/**
 * 加盟店申請の2つの独立した窓口のE2E。
 *
 * - /apply    … 介護施設向け（QOLC）。QOLCサイトの一部。
 * - /merchant … 一般の店舗・事業所向け。UD名義の独立サイト。
 *
 * 重要な受け入れ条件は「/merchant から QOLC への動線が一切無いこと」。
 * ヘッダー・フッター・ページタイトル・本文のすべてを検査して固定する。
 * 紹介サイトは `/site/*` セグメント実装（本番は qolc.jp で rewrite）。
 */
test.describe("介護施設向け 加盟店申請（/apply）", () => {
  test("QOLCサイトの一部として施設表記で表示される", async ({ page }) => {
    await page.goto("/site/apply");
    await expect(page.getByRole("heading", { name: "加盟店申請" })).toBeVisible();
    await expect(page.getByText("施設情報", { exact: true })).toBeVisible();
  });

  test("区分の選択画面や一般向けへの切替リンクを持たない", async ({ page }) => {
    await page.goto("/site/apply");
    await expect(page.getByText("ご利用の形態をお選びください")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /一般の店舗・事業所向け/ })
    ).toHaveCount(0);
  });

  test("旧 ?type=general のリンクは /merchant へ引き継がれる", async ({ page }) => {
    await page.goto("/site/apply?type=general");
    await expect(page).toHaveURL(/\/merchant$/);
  });
});

test.describe("一般加盟店 申請（/merchant）", () => {
  test("店舗・事業所表記のフォームが表示される", async ({ page }) => {
    await page.goto("/site/merchant");
    await expect(page.getByRole("heading", { name: "加盟店申請" })).toBeVisible();
    await expect(page.getByText("店舗・事業所情報")).toBeVisible();
    await expect(
      page.locator(".apply-form-label", { hasText: "店舗・事業所名" }).first()
    ).toBeVisible();
  });

  test("ページ全体に QOLC・介護・施設 の語が出ない", async ({ page }) => {
    await page.goto("/site/merchant");
    const body = page.locator("main.ud-root");
    await expect(body).not.toContainText("QOLC");
    await expect(body).not.toContainText("介護");
    await expect(body).not.toContainText("施設", { useInnerText: true });
  });

  test("ページタイトルが UD 名義で、介護・QOLC を含まない", async ({ page }) => {
    await page.goto("/site/merchant");
    const title = await page.title();
    expect(title).toContain("ユニバーサル・デベロップメント");
    expect(title).not.toContain("QOLC");
    expect(title).not.toContain("介護");
  });

  test("QOLCサイトへのリンクを1本も持たない", async ({ page }) => {
    await page.goto("/site/merchant");
    const hrefs = await page.locator("a").evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute("href") ?? "")
    );
    // 外部リンクは uni-dev.jp と mailto のみ。QOLC のページ・ポータルは不可。
    for (const href of hrefs) {
      expect(href).not.toContain("qolc");
      expect(href).not.toMatch(/^\/(apply|jcb|contact)?$/);
    }
  });
});
