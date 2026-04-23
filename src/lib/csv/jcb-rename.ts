import type { DataType } from "./naming";

export interface JcbDetectionResult {
  dataType: DataType | null;
  columns: string[];
  columnCount: number;
  reason: string;
}

const HEADER_SCAN_BYTES = 64 * 1024;

export async function readJcbHeaderLine(file: File): Promise<string> {
  const slice = file.slice(0, Math.min(file.size, HEADER_SCAN_BYTES));
  const buffer = await slice.arrayBuffer();
  const decoded = new TextDecoder("shift-jis").decode(buffer);
  const newlineIndex = decoded.search(/\r\n|\n|\r/);
  return newlineIndex === -1 ? decoded : decoded.slice(0, newlineIndex);
}

export function parseHeaderLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

export function detectJcbDataType(columns: string[]): JcbDetectionResult {
  const set = new Set(columns);
  const has = (name: string) => set.has(name);

  if (has("集計日") && has("加盟店番号") && has("加盟店名")) {
    return {
      dataType: "FM",
      columns,
      columnCount: columns.length,
      reason: "振込明細(FM): 「集計日」「加盟店番号」「加盟店名」を検出",
    };
  }

  if (has("手数料率") && has("振込金額") && has("売上件数") && !has("集計日")) {
    return {
      dataType: "FI",
      columns,
      columnCount: columns.length,
      reason: "振込情報(FI): 「手数料率」「振込金額」「売上件数」を検出",
    };
  }

  if (has("カード番号") || has("利用明細書表示名") || has("承認番号")) {
    return {
      dataType: "UR",
      columns,
      columnCount: columns.length,
      reason: "売上明細(UR): 「カード番号」または「利用明細書表示名」「承認番号」を検出",
    };
  }

  return {
    dataType: null,
    columns,
    columnCount: columns.length,
    reason: "判別不可: UR/FI/FM いずれの特徴列も見つかりません",
  };
}

export async function detectJcbFromFile(file: File): Promise<JcbDetectionResult> {
  const line = await readJcbHeaderLine(file);
  const columns = parseHeaderLine(line);
  return detectJcbDataType(columns);
}
