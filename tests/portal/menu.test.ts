/**
 * menu（ポータルメニュー定義）のテスト
 * 業務ファースト構成（2026-07-21）: 上段=業務、下段=台帳・ツールの2セクション。
 */
import { describe, it, expect } from "vitest";

import { PORTAL_MENUS, PORTAL_MENU_SECTIONS } from "@/lib/portal/menu";

describe("admin メニュー（業務ファースト構成）", () => {
  const sections = PORTAL_MENU_SECTIONS.admin;

  it("先頭セクションは「今日のUD」（/admin/today）のみ", () => {
    expect(sections[0].title).toBeUndefined();
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].items[0]).toMatchObject({ href: "/admin/today", label: "今日のUD" });
  });

  it("業務セクション: 相談・問い合わせ／加盟店申請・登録／日次決済／月次精算／その他業務", () => {
    const gyomu = sections.find((s) => s.title === "業務");
    expect(gyomu).toBeDefined();
    expect(gyomu!.items.map((m) => m.href)).toEqual([
      "/admin/inquiries",
      "/admin/applications",
      "/admin/payments",
      "/admin/tasks",
      "/admin/other-tasks",
    ]);
    expect(gyomu!.items[0].label).toBe("相談・問い合わせ");
    expect(gyomu!.items[1].label).toBe("加盟店申請・登録");
  });

  it("台帳・ツールセクションに既存の参照系ページがすべて残っている", () => {
    const daicho = sections.find((s) => s.title === "台帳・ツール");
    expect(daicho).toBeDefined();
    const hrefs = daicho!.items.map((m) => m.href);
    for (const h of [
      "/admin/dashboard",
      "/admin/facilities",
      "/admin/merchants",
      "/admin/csv-tools",
      "/admin/logs",
      "/admin/master",
    ]) {
      expect(hrefs).toContain(h);
    }
  });

  it("フラット版 PORTAL_MENUS はセクションの並び順を保つ（BottomNav 互換）", () => {
    const flat = PORTAL_MENUS.admin.map((m) => m.href);
    expect(flat[0]).toBe("/admin/today");
    expect(flat).toEqual(sections.flatMap((s) => s.items.map((m) => m.href)));
    // href の重複がない
    expect(new Set(flat).size).toBe(flat.length);
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
