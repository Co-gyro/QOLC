/**
 * UD Payment の画面モード。
 * - demo:    /udpay（デモ用ストア・営業/研修用。認証なし・外部決済なし）
 * - billing: /billing（本番。加盟店の担当者・承認者がログインして使う。本番テーブル・USEN 本番）
 * 画面部品は共通で、リンク先・API・データの読み書き先だけが変わる。
 */
export type UdpayMode = "demo" | "billing";

/** モードごとの画面ベースパスと操作 API */
export function udpayPaths(mode: UdpayMode): { base: string; api: string } {
  return mode === "billing" ? { base: "/billing", api: "/api/billing" } : { base: "/udpay", api: "/api/udpay" };
}

/** URL のパスからモードを決める（クライアント部品用） */
export function modeFromPathname(pathname: string | null): UdpayMode {
  return pathname?.startsWith("/billing") ? "billing" : "demo";
}
