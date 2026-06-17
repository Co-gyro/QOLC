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

  // EC設定可能業態コードが選択肢に並ぶ
  await expect(select.locator("option")).toContainText(["選択してください", "60207: 単科病院"]);

  // 訪問診療(単科病院)を選ぶと値が 60207 になる
  await select.selectOption("60207");
  await expect(select).toHaveValue("60207");

  // 店頭専用コード(介護60801)は選択肢に存在しない
  await expect(select.locator('option[value="60801"]')).toHaveCount(0);
});
