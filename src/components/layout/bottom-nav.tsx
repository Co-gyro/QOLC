/**
 * モバイル/LIFF 向け下部タブバー（LINEアプリ内での操作に最適）。
 *
 * - スマホ幅でのみ表示（md未満）。md以上では Sidebar を使う。
 * - 画面下部に固定。iPhone のホームインジケータ領域（safe-area）を考慮。
 * - フォントは QOLC ルールの最小 14px（text-sm）を維持。
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PORTAL_MENUS } from "@/lib/portal/menu";
import { MENU_ICONS } from "./menu-icons";
import type { PortalType } from "@/types";

export interface BottomNavProps {
  portal: PortalType;
}

export function BottomNav({ portal }: BottomNavProps) {
  const pathname = usePathname();
  const items = PORTAL_MENUS[portal];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t flex bg-white"
      style={{
        borderColor: "var(--qolc-border)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      aria-label="メインメニュー"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon ? MENU_ICONS[item.icon] : undefined;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 px-1",
              active ? "font-semibold" : "text-gray-600"
            )}
            style={active ? { color: "var(--qolc-primary)" } : undefined}
            aria-current={active ? "page" : undefined}
          >
            {Icon && <Icon size={22} strokeWidth={active ? 2.25 : 1.75} className="shrink-0" />}
            <span className="text-sm leading-tight truncate max-w-full">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
