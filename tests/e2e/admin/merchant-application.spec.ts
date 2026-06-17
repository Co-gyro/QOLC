import { test, expect } from "@playwright/test";
import { login } from "../helpers";

/**
 * JCB加盟店申請フォームの業態コード ドロップダウン（基本合意書 別紙3 マスタ）を検証。
 */
test("業態コードがドロップダウンで選択でき、5桁コードがセットされる", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/merchant-application");

  const select = page.locator("select#bizCatCode");
  await expect(select).toBeVisible();

  // QOLC主要業種が選択肢に並ぶ
  await expect(select.locator("option")).toContainText(["選択してください", "60801: 介護サービス"]);

  // 介護サービスを選ぶと値が 60801 になる
  await select.selectOption("60801");
  await expect(select).toHaveValue("60801");

  // 訪問診療を選ぶと 60207
  await select.selectOption("60207");
  await expect(select).toHaveValue("60207");
});
