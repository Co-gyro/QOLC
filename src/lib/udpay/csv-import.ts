import { convert, detect } from "encoding-japanese";
import Papa from "papaparse";
import type { UdpayCustomer, UdpayInvoiceLine } from "./types";

/**
 * UD Payment: 月次請求のCSV一括取込。
 *
 * ランサイド様の既存請求管理（Excel等）からの移行を想定した最小フォーマット:
 *   顧客名, 摘要, 数量, 単価（税抜）
 *   ※顧客の特定は「顧客メール」列があればメール優先、なければ顧客名の完全一致
 *   ※数量は省略可（省略時1）。単価はカンマ・円記号入りでも可
 * 文字コードは UTF-8 / Shift-JIS(CP932) 自動判定。列名は表記ゆれを吸収する。
 */

/** CSVの1明細行（顧客特定キー付き） */
export interface CsvImportRow {
  /** 元CSVの行番号（ヘッダ=1行目、データは2行目〜） */
  line: number;
  /** 顧客名（顧客名列の値。空なら undefined） */
  name?: string;
  /** 顧客メール（メール列の値。空なら undefined） */
  email?: string;
  description: string;
  quantity: number;
  /** 税抜単価（円） */
  unitPrice: number;
}

/** パース時の警告（該当行はスキップし処理は継続） */
export interface CsvImportWarning {
  line: number;
  message: string;
}

export interface CsvParseResult {
  rows: CsvImportRow[];
  warnings: CsvImportWarning[];
}

/** 顧客マッチ後のグループ（1顧客=1請求書分の明細） */
export interface CsvMatchedGroup {
  customerId: string;
  customerName: string;
  lines: Omit<UdpayInvoiceLine, "id">[];
}

export interface CsvMatchResult {
  groups: CsvMatchedGroup[];
  /** 顧客を特定できなかった行 */
  unmatched: { line: number; key: string; reason: string }[];
}

/** 列名の表記ゆれ吸収（NFKC正規化・空白除去・小文字化） */
function normHeader(s: string): string {
  return s.normalize("NFKC").replace(/\s/g, "").toLowerCase();
}

const HEADER_ALIASES = {
  name: ["顧客名", "医院名", "顧客", "店舗名", "名称", "得意先名"],
  email: ["顧客メール", "メール", "メールアドレス", "email", "e-mail"],
  description: ["摘要", "品目", "内容", "項目", "サービス名", "商品名"],
  quantity: ["数量", "個数", "qty"],
  unitPrice: ["単価", "単価(税抜)", "単価（税抜）", "税抜単価", "金額", "金額(税抜)", "金額（税抜）"],
} as const;

/** SJIS/UTF-8 バイナリ or 文字列 → UTF-8 文字列（other-cost-csv と同方式） */
function decodeToUtf8(input: Uint8Array | string): string {
  if (typeof input === "string") return input.replace(/^﻿/, "");
  const arr = Array.from(input);
  const detected = detect(arr);
  const from = detected === "UTF8" || detected === "ASCII" ? "UTF8" : "SJIS";
  const converted = convert(arr, { to: "UNICODE", from, type: "string" });
  const text = typeof converted === "string" ? converted : String(converted);
  return text.replace(/^﻿/, "");
}

/** 金額文字列を数値へ（カンマ・円記号・全角数字を吸収。不正は null） */
function parseAmount(raw: string): number | null {
  const s = raw.normalize("NFKC").replace(/[,¥￥円\s]/g, "");
  if (!/^\d+$/.test(s)) return null;
  return Number(s);
}

/**
 * 請求CSVをパースする。必須列: 顧客名またはメール／摘要／単価。
 */
export function parseUdpayInvoiceCsv(input: Uint8Array | string): CsvParseResult {
  const text = decodeToUtf8(input);
  const warnings: CsvImportWarning[] = [];
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const headers = parsed.meta.fields ?? [];
  const colOf = (field: keyof typeof HEADER_ALIASES): string | null => {
    const aliases = HEADER_ALIASES[field].map(normHeader);
    return headers.find((h) => aliases.includes(normHeader(h))) ?? null;
  };
  const nameCol = colOf("name");
  const emailCol = colOf("email");
  const descCol = colOf("description");
  const qtyCol = colOf("quantity");
  const priceCol = colOf("unitPrice");
  if ((!nameCol && !emailCol) || !descCol || !priceCol) {
    return {
      rows: [],
      warnings: [
        {
          line: 1,
          message:
            "ヘッダ行に必須列が見つかりません（顧客名またはメール／摘要／単価）。テンプレートCSVをご利用ください",
        },
      ],
    };
  }

  const rows: CsvImportRow[] = [];
  parsed.data.forEach((record, i) => {
    const line = i + 2;
    const name = (nameCol ? record[nameCol] : "")?.trim() || undefined;
    const email = (emailCol ? record[emailCol] : "")?.trim() || undefined;
    const description = (record[descCol] ?? "").trim();
    const priceRaw = (record[priceCol] ?? "").trim();
    if (!name && !email && !description && !priceRaw) return; // 完全空行
    if (!name && !email) {
      warnings.push({ line, message: "顧客名・メールがどちらも空のためスキップしました" });
      return;
    }
    if (!description) {
      warnings.push({ line, message: "摘要が空のためスキップしました" });
      return;
    }
    const unitPrice = parseAmount(priceRaw);
    if (unitPrice === null) {
      warnings.push({ line, message: `単価「${priceRaw}」を数値として読めないためスキップしました` });
      return;
    }
    let quantity = 1;
    const qtyRaw = (qtyCol ? record[qtyCol] : "")?.trim();
    if (qtyRaw) {
      const q = parseAmount(qtyRaw);
      if (q === null || q < 1) {
        warnings.push({ line, message: `数量「${qtyRaw}」が不正のため 1 として扱いました` });
      } else {
        quantity = q;
      }
    }
    rows.push({ line, name, email, description, quantity, unitPrice });
  });
  return { rows, warnings };
}

/** 顧客名の照合キー（NFKC・空白除去） */
function normName(s: string): string {
  return s.normalize("NFKC").replace(/\s/g, "");
}

/**
 * CSV行を顧客に対応づけ、顧客ごとの明細グループにまとめる。
 * メール完全一致（大文字小文字無視）を優先し、なければ顧客名の正規化一致。
 * 同名顧客が複数いる場合は誤課金防止のため unmatched にする。
 */
export function matchRowsToCustomers(
  rows: CsvImportRow[],
  customers: Pick<UdpayCustomer, "id" | "name" | "email">[],
): CsvMatchResult {
  const byEmail = new Map<string, UdpayCustomer["id"]>();
  for (const c of customers) byEmail.set(c.email.toLowerCase(), c.id);
  const byName = new Map<string, { id: string; dup: boolean }>();
  for (const c of customers) {
    const key = normName(c.name);
    const prev = byName.get(key);
    byName.set(key, prev ? { ...prev, dup: true } : { id: c.id, dup: false });
  }
  const nameOf = new Map(customers.map((c) => [c.id, c.name]));

  const grouped = new Map<string, CsvMatchedGroup>();
  const unmatched: CsvMatchResult["unmatched"] = [];
  for (const row of rows) {
    let customerId: string | null = null;
    let reason = "";
    if (row.email && byEmail.has(row.email.toLowerCase())) {
      customerId = byEmail.get(row.email.toLowerCase()) ?? null;
    } else if (row.name) {
      const hit = byName.get(normName(row.name));
      if (hit?.dup) reason = "同名の顧客が複数登録されています（メール列で特定してください）";
      else if (hit) customerId = hit.id;
      else reason = "該当する顧客が見つかりません（顧客管理の登録名と一致させてください）";
    } else {
      reason = "メールが顧客登録と一致しません";
    }
    if (!customerId) {
      unmatched.push({ line: row.line, key: row.email ?? row.name ?? "", reason });
      continue;
    }
    const group =
      grouped.get(customerId) ??
      ({ customerId, customerName: nameOf.get(customerId) ?? "", lines: [] } as CsvMatchedGroup);
    group.lines.push({
      description: row.description,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      taxRate: 10,
    });
    grouped.set(customerId, group);
  }
  return { groups: Array.from(grouped.values()), unmatched };
}

/** 取込用テンプレートCSV（UTF-8 BOM・Excelでそのまま開ける）を生成する */
export function buildTemplateCsv(
  customers: Pick<UdpayCustomer, "name">[],
): string {
  const header = "顧客名,摘要,数量,単価（税抜）";
  const lines = customers.map((c) => `${c.name},基本サポート料金,1,9900`);
  return `﻿${[header, ...lines].join("\r\n")}\r\n`;
}
