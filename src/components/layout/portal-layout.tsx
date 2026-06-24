/**
 * ポータル共通レイアウト（sidebar + header + main）
 */
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { Header } from "./header";
import type { PortalType } from "@/types";

export interface PortalLayoutProps {
  portal: PortalType;
  userName?: string;
  userRole?: string;
  children: React.ReactNode;
}

export function PortalLayout({
  portal,
  userName,
  userRole,
  children,
}: PortalLayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar portal={portal} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header userName={userName} userRole={userRole} />
        {/* 下部タブバー分の余白を確保（モバイルのみ） */}
        <main className="flex-1 p-4 md:p-6 pb-32 md:pb-6 bg-white">{children}</main>
      </div>
      {/* モバイル/LIFF 向け下部タブバー（md未満で表示） */}
      <BottomNav portal={portal} />
    </div>
  );
}
