/**
 * ポータル共通サイドバー
 *
 * アイコンは Lucide React を使用。menu.ts の icon 名（文字列）を
 * Lucide コンポーネントへ動的にマッピング。
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PORTAL_MENU_SECTIONS, PORTAL_LABELS } from "@/lib/portal/menu";
import { MENU_ICONS as ICONS } from "./menu-icons";
import type { PortalType } from "@/types";

export interface SidebarProps {
  portal: PortalType;
}

export function Sidebar({ portal }: SidebarProps) {
  const pathname = usePathname();
  const sections = PORTAL_MENU_SECTIONS[portal];

  return (
    <aside
      className="hidden md:flex w-64 border-r min-h-screen p-4 flex-col gap-1"
      style={{ backgroundColor: "var(--qolc-bg-soft)", borderColor: "var(--qolc-border)" }}
    >
      <div className="px-1 py-3 mb-3 flex flex-col items-center">
        <Image
          src="/qolc-logo.png"
          alt="QOLC"
          width={1318}
          height={380}
          priority
          className="w-44 h-auto"
        />
        <p
          className="mt-3 text-sm font-semibold tracking-wide"
          style={{ color: "var(--qolc-primary)" }}
        >
          {PORTAL_LABELS[portal]}
        </p>
      </div>
      <nav className="flex flex-col gap-1">
        {sections.map((section, si) => (
          <div key={section.title ?? `sec-${si}`} className="flex flex-col gap-1">
            {section.title && (
              <p
                className="px-3 pt-4 pb-1 text-sm font-semibold tracking-wider select-none"
                style={{ color: "var(--qolc-muted)" }}
              >
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon ? ICONS[item.icon] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "qolc-btn px-3 py-2.5 rounded-lg text-sm flex items-center gap-3 transition-all",
                    active
                      ? "text-white font-semibold shadow-sm"
                      : "text-gray-700 hover:bg-white hover:translate-x-0.5"
                  )}
                  style={active ? { backgroundColor: "var(--qolc-primary)" } : undefined}
                >
                  {Icon && (
                    <Icon size={18} strokeWidth={active ? 2 : 1.75} className="shrink-0" />
                  )}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
