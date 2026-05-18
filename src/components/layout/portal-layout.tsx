/**
 * ポータル共通レイアウト（sidebar + header + main）
 */
import { Sidebar } from "./sidebar";
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
      <div className="flex-1 flex flex-col">
        <Header userName={userName} userRole={userRole} />
        <main className="flex-1 p-6 bg-white">{children}</main>
      </div>
    </div>
  );
}
