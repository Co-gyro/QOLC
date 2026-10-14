"use client";

import { usePathname } from "next/navigation";
import { modeFromPathname, udpayPaths, type UdpayMode } from "@/lib/udpay/mode";

/** 今いる画面（/udpay デモ or /billing 本番）のベースパス・操作 API・モード */
export function useUdpayPaths(): { base: string; api: string; mode: UdpayMode } {
  const mode = modeFromPathname(usePathname());
  return { ...udpayPaths(mode), mode };
}
