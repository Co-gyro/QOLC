/**
 * 訪問看護療養費マスター(基本テーブルCSV) → コード→名称マップ(JSON) 生成スクリプト
 *
 * 入力: tmp/masters/ 配下の訪問看護療養費 基本テーブルCSV（SJIS、社会保険診療報酬支払基金）
 *   レイアウト: [2]訪問看護療養費コード(9桁) [6]漢字名称 [15]金額(円)
 * 出力: src/lib/receipt/iryou-service-codes.json
 *   { "コード": "漢字名称", ... }（キー昇順）
 *
 * 実行: npx tsx scripts/gen-iryou-service-codes.ts
 * 改定で更新される。最新の基本テーブルCSVを tmp/masters/ に置いて再実行→JSONをコミット。
 *
 * 注: マスタ本体はコミットしない(tmp/=.gitignore)。改定をまたぐ過去月のコードは
 *     現行マスタに無いことがあり、その場合は名称解決でコード表示にフォールバックする。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { convert } from "encoding-japanese";

const MASTERS_DIR = "tmp/masters";
const OUT = "src/lib/receipt/iryou-service-codes.json";

/** 訪問看護療養費 基本テーブルのファイル判定（r_ALL*.csv 等のCSV） */
function isVnMasterCsv(name: string): boolean {
  return name.toLowerCase().endsWith(".csv");
}

function decodeSjis(buf: Buffer): string {
  return convert(Array.from(buf), { to: "UNICODE", from: "SJIS", type: "string" }) as string;
}

function main(): void {
  const files = readdirSync(MASTERS_DIR).filter(isVnMasterCsv);
  if (files.length === 0) {
    console.error(`${MASTERS_DIR} に訪問看護療養費 基本テーブルCSVがありません。`);
    process.exit(1);
  }

  const map = new Map<string, string>();
  for (const file of files) {
    const text = decodeSjis(readFileSync(join(MASTERS_DIR, file)));
    let rows = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      const cols = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
      const code = cols[2];
      const name = cols[6];
      // コードは9桁数字、名称必須。基本テーブル以外のCSVは行が合わず自然にスキップ。
      if (!/^\d{9}$/.test(code ?? "") || !name) continue;
      if (!map.has(code)) map.set(code, name);
      rows++;
    }
    console.log(`読込: ${file}（有効 ${rows} 行 / 累計 ${map.size} コード）`);
  }

  const sorted: Record<string, string> = {};
  for (const k of Array.from(map.keys()).sort()) sorted[k] = map.get(k) as string;
  writeFileSync(OUT, JSON.stringify(sorted, null, 0) + "\n", "utf8");
  console.log(`生成: ${OUT}（${map.size} コード）`);
}

main();
