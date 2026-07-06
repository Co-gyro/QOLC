/**
 * /admin インデックスページのリダイレクトテスト。
 * qolc.jp の「管理者ログイン」リンク先 `/admin` が 404 にならず
 * ダッシュボードへ誘導されることを保証する。
 */
import { describe, it, expect, vi } from "vitest";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

describe("/admin インデックスページ", () => {
  it("/admin/dashboard へリダイレクトする", async () => {
    const { default: AdminIndexPage } = await import(
      "../src/app/admin/page"
    );
    expect(() => AdminIndexPage()).toThrow("NEXT_REDIRECT:/admin/dashboard");
    expect(redirectMock).toHaveBeenCalledWith("/admin/dashboard");
  });
});
