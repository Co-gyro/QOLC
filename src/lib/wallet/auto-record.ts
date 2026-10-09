/**
 * QOLC Wallet: 支払いの自動記録（iPhone のショートカットの自動化から届く、ウォレットでの支払い）。
 * 純粋な関数。記録との結びつけの条件は社外秘。
 */
import { createHash, randomInt } from "node:crypto";
import { z } from "zod";

/** ショートカットから届く内容（項目名はショートカット側の辞書のキー） */
export const autoRecordPayloadSchema = z.object({
  merchant: z.string().max(200).optional(),
  amount: z.string().max(50).optional(),
  card: z.string().max(200).optional(),
  name: z.string().max(200).optional(),
  input: z.string().max(2000).optional(),
}).passthrough();
export type AutoRecordPayload = z.infer<typeof autoRecordPayloadSchema>;

/** 端末の鍵を作る（紛らわしい文字を除いた英数字） */
export function generateDeviceKey(length = 32): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join("");
}

/** 端末の鍵のハッシュ（DB にはこれだけを保存する） */
export function hashDeviceKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

/** 空白だけの文字列は null にする */
function clean(value: string | undefined): string | null {
  const s = (value ?? "").normalize("NFKC").trim();
  return s === "" ? null : s;
}

/** "¥1,234" "1,234円" "JP¥1,234" "1234.00" → 1234。読めなければ null */
export function parseAutoAmount(text: string | undefined): number | null {
  const s = clean(text);
  if (!s) return null;
  const m = s.replace(/[,\s]/g, "").match(/(\d+)(?:\.(\d+))?/);
  if (!m) return null;
  if (m[2] && /[1-9]/.test(m[2])) return null; // 円に小数はない（外貨などは読まない）
  const value = Number(m[1]);
  return value > 0 && value <= 10_000_000 ? value : null;
}

/** 届いた内容を保存する形にする */
export function normalizeAutoRecord(payload: AutoRecordPayload) {
  return {
    merchant_name: clean(payload.merchant),
    amount: parseAutoAmount(payload.amount),
    amount_text: clean(payload.amount),
    card_name: clean(payload.card),
    transaction_name: clean(payload.name),
  };
}

/** 結びつけの候補になる記録 */
export interface LinkCandidate {
  id: string;
  status: string;
  selectedAt: string;
  paidAt: string | null;
}

const BEFORE_SELECT_MS = 2 * 60_000;
const AROUND_PAID_MS = 10 * 60_000;
const OPEN_SELECTING_MS = 30 * 60_000;

/** 自動記録を、同じ施設の記録の1件に結びつける。該当がなければ null（記録のない支払い） */
export function linkAutoRecord(receivedAt: string, candidates: LinkCandidate[]): string | null {
  const t = Date.parse(receivedAt);
  const scored = candidates
    .filter((c) => c.status !== "cancelled")
    .map((c) => {
      const selected = Date.parse(c.selectedAt);
      if (t < selected - BEFORE_SELECT_MS) return null;
      if (c.paidAt) {
        const diff = Math.abs(Date.parse(c.paidAt) - t);
        return diff <= AROUND_PAID_MS ? { id: c.id, diff } : null;
      }
      return t - selected <= OPEN_SELECTING_MS ? { id: c.id, diff: Math.abs(t - selected) } : null;
    })
    .filter((x): x is { id: string; diff: number } => x !== null)
    .sort((a, b) => a.diff - b.diff);
  return scored[0]?.id ?? null;
}
