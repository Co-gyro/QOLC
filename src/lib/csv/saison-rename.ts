export interface SaisonUrDetectionResult {
  isSaisonUr: boolean;
  columns: string[];
  columnCount: number;
  reason: string;
}

const HEADER_SCAN_BYTES = 64 * 1024;

export async function readSaisonHeaderLine(file: File): Promise<string> {
  const slice = file.slice(0, Math.min(file.size, HEADER_SCAN_BYTES));
  const buffer = await slice.arrayBuffer();
  const decoded = new TextDecoder("shift-jis").decode(buffer);
  const newlineIndex = decoded.search(/\r\n|\n|\r/);
  return newlineIndex === -1 ? decoded : decoded.slice(0, newlineIndex);
}

export function parseHeaderLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

export function detectSaisonUr(columns: string[]): SaisonUrDetectionResult {
  const set = new Set(columns);
  const required = ["締年月日", "加盟店店舗No.", "売上合計"];
  const missing = required.filter((k) => !set.has(k));

  if (missing.length === 0) {
    return {
      isSaisonUr: true,
      columns,
      columnCount: columns.length,
      reason: "セゾン売上明細(UR): 「締年月日」「加盟店店舗No.」「売上合計」を検出",
    };
  }

  return {
    isSaisonUr: false,
    columns,
    columnCount: columns.length,
    reason: `セゾン売上明細と判定できません（未検出列: ${missing.join(", ")}）`,
  };
}

export async function detectSaisonUrFromFile(
  file: File,
): Promise<SaisonUrDetectionResult> {
  const line = await readSaisonHeaderLine(file);
  const columns = parseHeaderLine(line);
  return detectSaisonUr(columns);
}
