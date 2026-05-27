import { type Page, expect } from "@playwright/test";

export type Role = "admin" | "facility" | "provider" | "family";

/** テストユーザー（テスト環境専用。実運用前に削除すること） */
export const USERS: Record<Role, { email: string; password: string; home: string; heading: string }> = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? "admin@qolc.test",
    password: process.env.E2E_ADMIN_PASSWORD ?? "QolcAdmin#2026",
    home: "/admin/dashboard",
    heading: "運営者ダッシュボード",
  },
  facility: {
    email: process.env.E2E_FACILITY_EMAIL ?? "facility@qolc.test",
    password: process.env.E2E_FACILITY_PASSWORD ?? "QolcFacility#2026",
    home: "/facility/dashboard",
    heading: "施設ダッシュボード",
  },
  provider: {
    email: process.env.E2E_PROVIDER_EMAIL ?? "provider@qolc.test",
    password: process.env.E2E_PROVIDER_PASSWORD ?? "QolcProvider#2026",
    home: "/provider/dashboard",
    heading: "提供者ダッシュボード",
  },
  family: {
    email: process.env.E2E_FAMILY_EMAIL ?? "family@qolc.test",
    password: process.env.E2E_FAMILY_PASSWORD ?? "QolcFamily#2026",
    home: "/user/home",
    heading: "こんにちは",
  },
};

/** ログインしてロール別ホームへ遷移するまで待つ */
export async function login(page: Page, role: Role): Promise<void> {
  const u = USERS[role];
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(u.email);
  await page.getByLabel("パスワード").fill(u.password);
  await page.getByRole("button", { name: "ログイン", exact: false }).click();
  await page.waitForURL(`**${u.home}`, { timeout: 60_000 });
}

/** ログアウト（ヘッダーのログアウトフォーム） */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "ログアウト" }).click();
  await page.waitForURL("**/login", { timeout: 30_000 });
}

export { expect };
