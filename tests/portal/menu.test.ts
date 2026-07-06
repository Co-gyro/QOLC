/**
 * menu（ポータルメニュー定義）のテスト
 * 「今日のUD」「業務タスク」の追加と、既存項目が変わっていないことを確認する。
 */
import { describe, it, expect } from "vitest";

import { PORTAL_MENUS } from "@/lib/portal/menu";

describe("admin メニュー", () => {
  const admin = PORTAL_MENUS.admin;

  it("先頭は「今日のUD」（/admin/today）", () => {
    expect(admin[0]).toMatchObject({ href: "/admin/today", label: "今日のUD" });
  });

  it("「業務チェックリスト」（/admin/tasks）は「申請・相談」の直後にある", () => {
    const hubIdx = admin.findIndex((m) => m.href === "/admin/applications");
    expect(hubIdx).toBeGreaterThanOrEqual(0);
    expect(admin[hubIdx]).toMatchObject({ label: "申請・相談" });
    expect(admin[hubIdx + 1]).toMatchObject({
      href: "/admin/tasks",
      label: "業務チェックリスト",
    });
  });

  it("既存項目はすべて残っている", () => {
    const hrefs = admin.map((m) => m.href);
    for (const h of [
      "/admin/dashboard",
      "/admin/applications",
      "/admin/facilities",
      "/admin/merchants",
      "/admin/payments",
      "/admin/csv-tools",
      "/admin/logs",
      "/admin/master",
    ]) {
      expect(hrefs).toContain(h);
    }
  });

  it("他ポータルのメニューは変更していない", () => {
    expect(PORTAL_MENUS.facility.map((m) => m.href)).toEqual([
      "/facility/dashboard",
      "/facility/residents",
      "/facility/statements",
      "/facility/payments",
      "/facility/providers",
      "/facility/logs",
    ]);
    expect(PORTAL_MENUS.provider).toHaveLength(3);
    expect(PORTAL_MENUS.user).toHaveLength(4);
  });
});
