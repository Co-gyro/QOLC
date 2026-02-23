"use client";

import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

export default function MobileHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/user";

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-12 px-4">
        {isHome ? (
          <span className="text-lg font-bold text-emerald-600">{APP_NAME}</span>
        ) : (
          <button
            onClick={() => router.back()}
            className="flex items-center gap-0.5 text-emerald-600 -ml-1"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm">戻る</span>
          </button>
        )}
        <div className="text-xs text-gray-500">山田 太郎 様</div>
      </div>
    </header>
  );
}
