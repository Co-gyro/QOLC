/**
 * アップロードプレビュー JSON 構築
 *
 * statement_lines を「施設別 → 入居者別」にグルーピングして
 * プレビュー画面で表示する形に整形する。
 */

export interface PreviewLine {
  statementLineId: string;
  facilityId: string | null;
  residentId: string | null;
  residentName: string | null;
  insuranceNumber: string;
  serviceCode: string | null;
  serviceName: string | null;
  amount: number;
  selfPayAmount: number;
  matchStatus: "matched" | "unmatched" | "ambiguous";
}

export interface PreviewResidentGroup {
  residentId: string;
  residentName: string;
  totalAmount: number;
  lines: PreviewLine[];
}

export interface PreviewFacilityGroup {
  facilityId: string | null;
  facilityName: string;
  residents: PreviewResidentGroup[];
  unmatched: PreviewLine[];
  totalAmount: number;
}

export interface PreviewResult {
  batchId: string;
  facilities: PreviewFacilityGroup[];
  unmatched: PreviewLine[];
  totalAmount: number;
}

export interface PreviewMeta {
  facilityNames: Map<string, string>;
  residentNames: Map<string, string>;
}

const UNCLASSIFIED_KEY = "__unclassified__";

/**
 * フラットな PreviewLine[] を施設別→入居者別にグルーピングする。
 */
export function groupForPreview(
  batchId: string,
  lines: PreviewLine[],
  meta: PreviewMeta
): PreviewResult {
  const facilities = new Map<string, PreviewFacilityGroup>();
  const globalUnmatched: PreviewLine[] = [];

  for (const line of lines) {
    if (!line.facilityId) {
      globalUnmatched.push(line);
      continue;
    }

    let fg = facilities.get(line.facilityId);
    if (!fg) {
      fg = {
        facilityId: line.facilityId,
        facilityName:
          meta.facilityNames.get(line.facilityId) ?? "(不明施設)",
        residents: [],
        unmatched: [],
        totalAmount: 0,
      };
      facilities.set(line.facilityId, fg);
    }

    if (line.matchStatus !== "matched" || !line.residentId) {
      fg.unmatched.push(line);
      fg.totalAmount += line.amount;
      continue;
    }

    let rg = fg.residents.find((r) => r.residentId === line.residentId);
    if (!rg) {
      rg = {
        residentId: line.residentId,
        residentName:
          line.residentName ??
          meta.residentNames.get(line.residentId) ??
          "(不明)",
        totalAmount: 0,
        lines: [],
      };
      fg.residents.push(rg);
    }
    rg.lines.push(line);
    rg.totalAmount += line.amount;
    fg.totalAmount += line.amount;
  }

  const total =
    globalUnmatched.reduce((sum, l) => sum + l.amount, 0) +
    Array.from(facilities.values()).reduce((s, f) => s + f.totalAmount, 0);

  return {
    batchId,
    facilities: Array.from(facilities.values()),
    unmatched: globalUnmatched,
    totalAmount: total,
  };
}

export { UNCLASSIFIED_KEY };
