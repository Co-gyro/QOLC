/**
 * QOLC Wallet: 記録とレシートの検証（第1段階）。社外秘。
 * 純粋な関数。外れた場合も保存し、記録を要確認（mismatched）に回す。
 */

/** 検証に使う値 */
export interface ReceiptCheckInput {
  selectedAt: string;
  paidAt: string | null;
  enteredAmount: number | null;
  receiptAmount: number;
  printedAt: string | null;
  /** レシートに印字されていたカードの下4桁 */
  receiptCardLast4: string | null;
  /** 施設のカードの下4桁（Apple Pay の番号を含む） */
  facilityCardLast4s: string[];
}

/** 検証の結果。warnings が空なら合格 */
export interface ReceiptCheckResult {
  ok: boolean;
  warnings: string[];
}

const BEFORE_MS = 5 * 60_000;
const AFTER_MS = 10 * 60_000;

/** レシートの内容を記録と照らし合わせる */
export function checkReceipt(input: ReceiptCheckInput): ReceiptCheckResult {
  const warnings: string[] = [];

  if (input.enteredAmount !== null && input.enteredAmount !== input.receiptAmount) {
    warnings.push("支払い後に入力した金額とレシートの合計が違います。");
  }

  if (input.printedAt) {
    const printed = Date.parse(input.printedAt);
    const from = Date.parse(input.selectedAt) - BEFORE_MS;
    const to = Date.parse(input.paidAt ?? input.selectedAt) + AFTER_MS;
    if (Number.isFinite(printed) && (printed < from || printed > to)) {
      warnings.push("レシートの日時が、支払いの時刻と離れています。");
    }
  }

  if (
    input.receiptCardLast4 &&
    input.facilityCardLast4s.length > 0 &&
    !input.facilityCardLast4s.includes(input.receiptCardLast4)
  ) {
    warnings.push(`レシートのカード番号（下4桁 ${input.receiptCardLast4}）が施設のカードと違います。`);
  }

  return { ok: warnings.length === 0, warnings };
}
