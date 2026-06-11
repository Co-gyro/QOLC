/**
 * ポータル共通サイドバー
 */
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PORTAL_MENUS, PORTAL_LABELS } from "@/lib/portal/menu";
import type { PortalType } from "@/types";

export interface SidebarProps {
  portal: PortalType;
}

export function Sidebar({ portal }: SidebarProps) {
  const pathname = usePathname();
  const items = PORTAL_MENUS[portal];

  return (
    <aside
      className="w-64 border-r min-h-screen p-4 flex flex-col gap-1"
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
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "qolc-btn px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors",
                active ? "text-white font-semibold" : "text-gray-700 hover:bg-white"
              )}
              style={
                active
                  ? { backgroundColor: "var(--qolc-primary)" }
                  : undefined
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
