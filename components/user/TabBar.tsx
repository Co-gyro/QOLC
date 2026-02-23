"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, FileText, Receipt, CreditCard, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "ホーム", href: "/user", icon: Home },
  { label: "明細", href: "/user/statements", icon: FileText },
  { label: "領収書", href: "/user/receipts", icon: Receipt },
  { label: "カード", href: "/user/card", icon: CreditCard },
  { label: "設定", href: "/user/settings", icon: Settings },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[428px] bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/user"
              ? pathname === "/user"
              : pathname.startsWith(tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 min-w-[56px]",
                isActive ? "text-emerald-600" : "text-gray-400"
              )}
            >
              <Icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area bottom padding for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
