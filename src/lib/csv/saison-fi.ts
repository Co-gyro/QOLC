import { yyyymmddToSlashed } from "./naming";
import type { SaisonSalesRow } from "./saison-fm";
import { encodeShiftJis } from "./saison-fm";
import type { SaisonPdfData } from "@/lib/pdf/saison-pdf";

export interface FiRow {
  振込年月日: string;
  支払先番号: string;
  カード会社: "SAISON";
  締日: string;
  支払区分: string;
  売上件数: number;
  売上金額: number;
  手数料率: number;
  手数料: number;
  振込金額: number;
}

export interface FiFile {
  closingYyyymmdd: string;
  merchantStoreNo: string;
  merchantName: string;
  rows: FiRow[];
  totals: {
    件数: number;
    売上金額: number;
    手数料: number;
    振込金額: number;
  };
  pdf: {
    totalFee: number;
    totalTransfer: number;
    totalAmount: number;
    transferDate: string;
    closingDate: string;
  };
  ratePercent: number;
  rateDisplay: number;
  feeDifference: number;
  transferDifference: number;
}

export interface FiAggregateInput {
  payeeNumber: string;
}

const FI_HEADER = [
  "振込年月日",
  "支払先番号",
  "カード会社",
  "締日",
  "支払区分",
  "売上件数",
  "売上金額",
  "手数料率",
  "手数料",
  "振込金額",
];

function normalizeStoreNo(s: string): number | null {
  const n = Number(s.replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
}

function slashedToYyyymmdd(slashed: string): string {
  return slashed.replace(/\//g, "");
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function crossPdfCsvToFi(
  pdfs: SaisonPdfData[],
  rows: SaisonSalesRow[],
  input: FiAggregateInput,
): FiFile[] {
  const files: FiFile[] = [];

  for (const pdf of pdfs) {
    const pdfStore = normalizeStoreNo(pdf.merchantStoreNo);
    const closingYyyymmdd = slashedToYyyymmdd(pdf.closingDate);

    const matching = rows.filter((r) => {
      if (r.締年月日 !== closingYyyymmdd) return false;
      const rowStore = normalizeStoreNo(r.加盟店店舗No);
      return rowStore !== null && pdfStore !== null && rowStore === pdfStore;
    });

    const byPayment = new Map<string, { count: number; sum: number }>();
    for (const r of matching) {
      const cur = byPayment.get(r.支払方法) ?? { count: 0, sum: 0 };
      cur.count += 1;
      cur.sum += r.売上合計;
      byPayment.set(r.支払方法, cur);
    }

    const csvTotalAmount = matching.reduce((a, r) => a + r.売上合計, 0);
    const rawRatePercent =
      csvTotalAmount === 0 ? 0 : (pdf.totalFee / csvTotalAmount) * 100;
    const rateDisplay = round2(rawRatePercent);

    const paymentKeys = Array.from(byPayment.keys()).sort();
    const rowsOut: FiRow[] = [];
    let total件数 = 0;
    let total売上 = 0;
    let total手数料 = 0;
    let total振込 = 0;

    for (const payment of paymentKeys) {
      const { count, sum } = byPayment.get(payment)!;
      const fee = Math.round((sum * rawRatePercent) / 100);
      const transfer = sum - fee;
      rowsOut.push({
        振込年月日: pdf.transferDate,
        支払先番号: input.payeeNumber,
        カード会社: "SAISON",
        締日: pdf.closingDate,
        支払区分: payment,
        売上件数: count,
        売上金額: sum,
        手数料率: rateDisplay,
        手数料: fee,
        振込金額: transfer,
      });
      total件数 += count;
      total売上 += sum;
      total手数料 += fee;
      total振込 += transfer;
    }

    files.push({
      closingYyyymmdd,
      merchantStoreNo: pdf.merchantStoreNo,
      merchantName: pdf.merchantName,
      rows: rowsOut,
      totals: {
        件数: total件数,
        売上金額: total売上,
        手数料: total手数料,
        振込金額: total振込,
      },
      pdf: {
        totalFee: pdf.totalFee,
        totalTransfer: pdf.totalTransfer,
        totalAmount: pdf.totalAmount,
        transferDate: pdf.transferDate,
        closingDate: pdf.closingDate,
      },
      ratePercent: rawRatePercent,
      rateDisplay,
      feeDifference: pdf.totalFee - total手数料,
      transferDifference: pdf.totalTransfer - total振込,
    });
  }

  return files;
}

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function renderFiCsv(file: FiFile): string {
  const lines: string[] = [];
  lines.push(FI_HEADER.map(csvField).join(","));
  for (const r of file.rows) {
    lines.push(
      [
        r.振込年月日,
        r.支払先番号,
        r.カード会社,
        r.締日,
        r.支払区分,
        r.売上件数,
        r.売上金額,
        r.手数料率,
        r.手数料,
        r.振込金額,
      ]
        .map((v) => csvField(String(v)))
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

export function renderFiCsvBytes(file: FiFile): Uint8Array<ArrayBuffer> {
  return encodeShiftJis(renderFiCsv(file));
}

export { yyyymmddToSlashed };
