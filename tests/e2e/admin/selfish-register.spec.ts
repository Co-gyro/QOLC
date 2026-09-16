/**
 * 加盟店管理 → 「Selfish登録」ダイアログの E2E
 *
 * 確認すること（コードを置いた≠画面で見える、の再発防止）:
 *   - 一覧の各行に「Selfish登録」の導線があり、押すとダイアログが開く
 *   - チェックリスト・登録票・JSON が描画される
 *   - 「Selfish へ登録」ボタンは常に表示され、送れないときは理由が添えられる
 * 送信（POST）は行わない。連携先 env が未設定の環境ではボタンが無効になる。
 */
import { test, expect } from "@playwright/test";
import { login } from "../helpers";

test.describe("加盟店管理: Selfish 登録ダイアログ", () => {
  test("行アクションからダイアログを開き、チェックリストと登録票が見える", async ({ page }) => {
    await login(page, "admin");
    await page.goto("/admin/merchants");
    await expect(page.getByRole("heading", { name: "加盟店管理" })).toBeVisible();

    // 一覧は非同期に読み込まれるため、行が出るか空表示になるまで待つ
    const openButtons = page.getByRole("button", { name: "Selfish登録" });
    await expect(
      openButtons.first().or(page.getByText("加盟店がまだ登録されていません"))
    ).toBeVisible({ timeout: 60_000 });
    const count = await openButtons.count();
    test.skip(count === 0, "加盟店が0件のため導線を確認できない");

    await openButtons.first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: /Selfish（精算）へ支払先を登録/ })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "チェックリスト" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "登録票（Selfish の入力順）" })).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "連携データ（JSON）" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "JSON をコピー" })).toBeVisible();
    if (process.env.E2E_SHOT_DIR) {
      await page.screenshot({ path: `${process.env.E2E_SHOT_DIR}/selfish-dialog.png`, fullPage: true });
    }

    // JSON にスキーマ識別子と冪等キーが入っている
    const json = await dialog.locator("textarea").inputValue();
    expect(json).toContain('"schema": "qolc.merchant.v1"');
    expect(json).toContain('"external_id"');

    // 送信ボタンは常に表示。無効なら理由が添えられている
    const send = dialog.getByRole("button", { name: "Selfish へ登録" });
    await expect(send).toBeVisible();
    if (await send.isDisabled()) {
      await expect(dialog.getByText(/不足項目があります|連携先が未設定です/)).toBeVisible();
    }

    await dialog.getByRole("button", { name: "閉じる" }).click();
    await expect(dialog).toBeHidden();
  });
});
