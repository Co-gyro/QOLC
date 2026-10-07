/**
 * QOLC Wallet: カード明細と記録（宣言）の突合（第2段階）。社外秘。
 * 純粋な関数。DB の読み書きは API Route 側で行う。
 */

/** 突合に使う明細の行 */
export interface ReconcileLine {
  id: string;
  lineNo: number;
  cardId: string | null;
  facilityId: string | null;
  usageDate: string | null;
  merchantName: string | null;
  amount: number | null;
  isReference: boolean;
}

/** 突合に使う記録 */
export interface ReconcileDeclaration {
  id: string;
  facilityId: string;
  cardId: string | null;
  amount: number | null;
  /** レシートの日付（無ければ支払いの日付）。日本時間の YYYY-MM-DD */
  purchaseDate: string;
  merchantName: string | null;
  paidAt: string | null;
}

/** 行ごとの結果 */
export interface LineResult {
  lineId: string;
  status: "matched" | "needs_review" | "excluded";
  declarationId: string | null;
  reason: string | null;
}

/** 突合の結果 */
export interface ReconcileResult {
  lines: LineResult[];
  /** どの明細行とも結びつかなかった記録 */
  unmatchedDeclarationIds: string[];
}

const DATE_TOLERANCE_DAYS = 1;

/** 2つの YYYY-MM-DD の日数差（絶対値） */
export function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/** 店名の比較用の形（NFKC・小文字・空白と記号を除く） */
export function normalizeMerchant(name: string | null): string {
  return (name ?? "").normalize("NFKC").toLowerCase().replace(/[\s\-_/・.,()（）「」]/g, "");
}

/** 店名が似ているか（どちらかが他方の先頭3文字以上を含む） */
export function merchantSimilar(a: string | null, b: string | null): boolean {
  const x = normalizeMerchant(a);
  const y = normalizeMerchant(b);
  if (x.length < 3 || y.length < 3) return false;
  return x.includes(y.slice(0, 3)) || y.includes(x.slice(0, 3));
}

/** 明細の各行に、条件に合う記録を1件ずつ割り当てる */
export function reconcile(lines: ReconcileLine[], declarations: ReconcileDeclaration[]): ReconcileResult {
  const used = new Set<string>();
  const ordered = [...lines].sort(
    (a, b) => (a.usageDate ?? "").localeCompare(b.usageDate ?? "") || a.lineNo - b.lineNo,
  );
  const results = new Map<string, LineResult>();

  for (const line of ordered) {
    const result = (status: LineResult["status"], declarationId: string | null, reason: string | null) =>
      results.set(line.id, { lineId: line.id, status, declarationId, reason });

    if (line.isReference || line.usageDate === null || line.amount === null) {
      result("excluded", null, "利用明細ではない行");
      continue;
    }
    if (line.facilityId === null) {
      result("needs_review", null, "登録のないカードの利用");
      continue;
    }
    const usageDate = line.usageDate;
    const candidates = declarations.filter(
      (d) =>
        !used.has(d.id) &&
        d.facilityId === line.facilityId &&
        (line.cardId === null || d.cardId === null || d.cardId === line.cardId) &&
        d.amount === line.amount &&
        dayDiff(d.purchaseDate, usageDate) <= DATE_TOLERANCE_DAYS,
    );
    const picked = pick(candidates, line);
    if (picked) {
      used.add(picked.id);
      result("matched", picked.id, null);
    } else {
      result("needs_review", null, candidates.length === 0 ? "記録のない利用" : "候補が複数あり特定できない");
    }
  }

  return {
    lines: lines.map((l) => results.get(l.id)!),
    unmatchedDeclarationIds: declarations.filter((d) => !used.has(d.id)).map((d) => d.id),
  };
}

/** 候補から1件に絞る。絞れなければ null */
function pick(candidates: ReconcileDeclaration[], line: ReconcileLine): ReconcileDeclaration | null {
  if (candidates.length <= 1) return candidates[0] ?? null;
  const sameDay = candidates.filter((d) => d.purchaseDate === line.usageDate);
  const pool = sameDay.length > 0 ? sameDay : candidates;
  if (pool.length === 1) return pool[0];
  const similar = pool.filter((d) => merchantSimilar(d.merchantName, line.merchantName));
  if (similar.length === 1) return similar[0];
  // 同じ日・同じ店・同じ金額なら、どれに割り当てても請求額は変わらない
  const group = similar.length > 0 ? similar : pool;
  const sameShop = group.every(
    (d) => d.purchaseDate === group[0].purchaseDate && normalizeMerchant(d.merchantName) === normalizeMerchant(group[0].merchantName),
  );
  if (!sameShop) return null;
  return [...group].sort((a, b) => (a.paidAt ?? "").localeCompare(b.paidAt ?? ""))[0];
}
