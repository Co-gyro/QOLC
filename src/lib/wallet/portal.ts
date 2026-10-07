/**
 * QOLC Wallet: 施設ポータル・運営センターの画面で使う計算（純粋な関数）。
 */
import type { DeclarationDto } from "./declarations";

/** "2026-10" → その月の初日と末日（YYYY-MM-DD） */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

/** "2026-10" を n か月ずらす */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** 入居者別の合計 */
export interface ResidentTotal {
  residentId: string;
  residentName: string;
  total: number;
  count: number;
  awaitingReceipt: number;
}

/** 記録を入居者ごとに合計する（取消は除く。金額はレシートの合計、無ければ入力金額） */
export function residentTotals(rows: DeclarationDto[]): ResidentTotal[] {
  const map = new Map<string, ResidentTotal>();
  for (const r of rows) {
    if (r.status === "cancelled") continue;
    const t = map.get(r.resident_id) ?? {
      residentId: r.resident_id, residentName: r.resident_name, total: 0, count: 0, awaitingReceipt: 0,
    };
    t.total += r.amount ?? r.entered_amount ?? 0;
    t.count += 1;
    if (r.status === "awaiting_receipt") t.awaitingReceipt += 1;
    map.set(r.resident_id, t);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
