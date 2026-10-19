import Papa from "papaparse";
import { decodeToUtf8, normHeader } from "./csv-import";

/**
 * 顧客のCSV一括登録（先行顧客のリストを一度に登録する）。
 * Excel で作った CSV（Shift-JIS / UTF-8）を読み、1行＝1顧客にする。
 * 必須: 医院名・宛先（To）のメール。決済日が空なら加盟店の標準日（ランサイド様は15日）。
 */

/** 読み込んだ顧客1件 */
export interface CustomerCsvRow {
  /** CSV の行番号（見出しを1行目として2から） */
  line: number;
  name: string;
  contactName: string;
  email: string;
  cc: string[];
  anniversaryDay: number;
  postalCode?: string;
  address1?: string;
  address2?: string;
  note?: string;
}

/** 読み込みの注意（スキップした行など） */
export interface CustomerCsvWarning {
  line: number;
  message: string;
}

const ALIASES = {
  name: ["医院名", "顧客名", "会社名", "医院名・会社名", "名称", "得意先名"],
  contactName: ["担当者名", "担当者", "ご担当者", "先生", "氏名"],
  email: ["メール", "メールアドレス", "宛先", "宛先(to)", "to", "email", "e-mail"],
  cc: ["cc", "宛先(cc)", "ccメール"],
  day: ["決済日", "毎月の決済日", "引落日"],
  postalCode: ["郵便番号", "〒"],
  address1: ["住所", "住所1", "住所1行目"],
  address2: ["住所2", "建物名", "住所2行目"],
  note: ["備考", "社内メモ", "メモ"],
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 顧客CSVを読む。
 * @param allowedDays 加盟店が使える決済日（先頭が標準日）。範囲外・空は標準日にして注意を出す
 */
export function parseCustomerCsv(input: Uint8Array | string, allowedDays: number[]): { rows: CustomerCsvRow[]; warnings: CustomerCsvWarning[] } {
  const text = decodeToUtf8(input);
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
  const headers = parsed.meta.fields ?? [];
  const col = (k: keyof typeof ALIASES) => {
    const names = ALIASES[k].map(normHeader);
    return headers.find((h) => names.includes(normHeader(h))) ?? null;
  };
  const c = Object.fromEntries((Object.keys(ALIASES) as (keyof typeof ALIASES)[]).map((k) => [k, col(k)])) as Record<keyof typeof ALIASES, string | null>;
  const warnings: CustomerCsvWarning[] = [];
  if (!c.name || !c.email) {
    return { rows: [], warnings: [{ line: 1, message: "「医院名」と「メール」の列が必要です（1行目に見出しを入れてください）" }] };
  }
  const standard = allowedDays[0] ?? 15;
  const rows: CustomerCsvRow[] = [];
  const seen = new Set<string>();
  parsed.data.forEach((r, i) => {
    const line = i + 2;
    const get = (k: keyof typeof ALIASES) => (c[k] ? (r[c[k] as string] ?? "").normalize("NFKC").trim() : "");
    const name = (c.name ? (r[c.name] ?? "") : "").trim();
    const email = get("email").toLowerCase();
    if (!name) return warnings.push({ line, message: "医院名が空のためスキップしました" });
    if (!EMAIL_RE.test(email)) return warnings.push({ line, message: `メール「${email}」が正しくないためスキップしました` });
    const key = `${name}|${email}`;
    if (seen.has(key)) return warnings.push({ line, message: `${name} が重複しているためスキップしました` });
    seen.add(key);
    const cc = get("cc").split(/[;；,、\s]+/).map((x) => x.toLowerCase()).filter(Boolean);
    const badCc = cc.filter((x) => !EMAIL_RE.test(x));
    if (badCc.length) warnings.push({ line, message: `CC「${badCc.join(", ")}」は正しくないため外しました` });
    const dayRaw = get("day").replace(/日$/, "");
    let day = standard;
    if (dayRaw) {
      const d = Number(dayRaw);
      if (allowedDays.includes(d)) day = d;
      else warnings.push({ line, message: `決済日「${get("day")}」は使えないため、標準の${standard}日にしました` });
    }
    const postal = get("postalCode");
    rows.push({
      line,
      name,
      contactName: get("contactName"),
      email,
      cc: cc.filter((x) => EMAIL_RE.test(x)),
      anniversaryDay: day,
      postalCode: /^\d{3}-?\d{4}$/.test(postal) ? postal : undefined,
      address1: get("address1") || undefined,
      address2: get("address2") || undefined,
      note: get("note") || undefined,
    });
  });
  return { rows, warnings };
}

/** 取込用のひな形CSV（UTF-8 BOM・Excel でそのまま開ける） */
export function customerCsvTemplate(): string {
  const header = "医院名,担当者名,メール,CC,決済日,郵便番号,住所,住所2,備考";
  const sample = "医療法人社団〇〇会　〇〇歯科医院,山田,info@example.com,keiri@example.com,15,100-0006,東京都千代田区有楽町2-7-1,〇〇ビル3階,請求書は院長と経理へ";
  return `﻿${header}\r\n${sample}\r\n`;
}
