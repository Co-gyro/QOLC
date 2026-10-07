/**
 * QOLC Wallet の PC 画面（施設ポータル「お買い物」・運営センター「お買い物の明細照合」）の主要動線。
 * 開発・デモ用環境（qolc-dev）のデモ用アカウントで実行する:
 *   PLAYWRIGHT_BASE_URL=http://localhost:3100 PLAYWRIGHT_NO_WEBSERVER=1 \
 *   E2E_FACILITY_EMAIL=wallet-demo@uni-dev.jp E2E_FACILITY_PASSWORD=… \
 *   E2E_ADMIN_EMAIL=wallet-demo-admin@uni-dev.jp E2E_ADMIN_PASSWORD=… npx playwright test tests/e2e/wallet
 * 事前に iPhone アプリ（または scripts）で当日の記録を作っておくこと。
 */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "@playwright/test";
import { expect, login, logout } from "../helpers";

const SHOTS = process.env.WALLET_SCREENSHOT_DIR;

test.describe("QOLC Wallet PC 画面", () => {
  test.skip(!process.env.E2E_FACILITY_EMAIL?.startsWith("wallet-demo"), "Wallet のデモ用アカウントが指定されていません");

  test("施設ポータル: お買い物の一覧とレシート", async ({ page }) => {
    await login(page, "facility");
    await page.getByRole("link", { name: "お買い物" }).first().click();
    await expect(page.getByRole("heading", { name: "お買い物" })).toBeVisible();
    await expect(page.getByText("森 はるこ さん").first()).toBeVisible({ timeout: 30_000 });
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "facility-wallet.png"), fullPage: true });

    await page.getByRole("img", { name: "レシート" }).first().click();
    await expect(page.getByRole("dialog", { name: "レシート" })).toBeVisible();
    await expect(page.getByText("読み取った明細")).toBeVisible();
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "facility-receipt.png") });
    await page.getByRole("button", { name: "閉じる" }).click();
    await logout(page);
  });

  test("運営センター: 明細 CSV の取込と突合", async ({ page }) => {
    const today = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10).replaceAll("-", "");
    const csv = join(mkdtempSync(join(tmpdir(), "wallet-")), `aplus-${today}.csv`);
    writeFileSync(csv, "﻿" + [
      "カード番号,請求月,ご利用日,ご利用店名,ご利用金額,売上種別,支払回数,今回回数,お支払金額,摘要（現地通貨額など）",
      `≪****-****-****-7152≫,202610,${today},ﾌｧﾐﾘｰﾏｰﾄ ｱｰﾊﾞﾝﾈｯﾄｳﾁｻｲﾜｲﾁｮｳ,129,Ｓ,1,01,129,`,
      `≪****-****-****-7152≫,202610,${today},ﾌｧﾐﾘｰﾏｰﾄ ｱｰﾊﾞﾝﾈｯﾄｳﾁｻｲﾜｲﾁｮｳ,319,Ｓ,1,01,319,`,
      `≪****-****-****-7152≫,202610,${today},ｽｰﾊﾟｰﾏﾙﾔﾏ,3480,Ｓ,1,01,3480,`,
      ",202610,,手数料,220,,,,220,",
    ].join("\r\n") + "\r\n");

    await login(page, "admin");
    await page.goto("/admin/wallet/statements");
    await expect(page.getByRole("heading", { name: "お買い物の明細照合" })).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(csv);
    await expect(page.getByText("「突合する」を押すと")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "突合する" }).first().click();
    await expect(page.getByText("要確認が 1 件あります")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("照合済み").first()).toBeVisible();
    if (SHOTS) await page.screenshot({ path: join(SHOTS, "admin-statements.png"), fullPage: true });
  });
});
