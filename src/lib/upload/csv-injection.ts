/**
 * CSV インジェクション対策
 *
 * Excel / Numbers 等で CSV を開いた際、セルの先頭が `= + - @ \t \r` などで
 * 始まる場合に式として解釈される脆弱性がある。
 * 安全のため、保存値の先頭が危険文字なら `'` をプレフィックスする。
 *
 * 参考: OWASP CSV Injection
 */

const DANGEROUS_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * セル値が CSV インジェクション攻撃に該当するか判定し、必要なら無害化する。
 */
export function sanitizeCell(value: string): string {
  if (!value || value.length === 0) return value;
  const first = value.charAt(0);
  if (DANGEROUS_PREFIXES.includes(first)) {
    return `'${value}`;
  }
  return value;
}

/**
 * オブジェクト中の全文字列フィールドを sanitizeCell で処理する。
 */
export function sanitizeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (typeof v === "string") {
      out[k] = sanitizeCell(v);
    }
  }
  return out as T;
}
