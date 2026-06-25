/**
 * 介護給付費単位数等サービスコード表(Excel) → コード→名称マップ(JSON) 生成スクリプト
 *
 * 入力: tmp/masters/ 配下の全 .xlsx（介護サービスコード表。カテゴリ別に複数可）
 *   各データシート: [1]種類(2桁) [2]項目(4桁) [3]サービス内容略称（6行目以降）
 * 出力: src/lib/receipt/kaigo-service-codes.json
 *   { "種類:項目": "サービス内容略称", ... }（キー昇順・差分安定のため）
 *
 * 実行: npx tsx scripts/gen-kaigo-service-codes.ts
 * マスタ更新時はExcelを tmp/masters/ に置き換えて再実行 → 生成JSONをコミット。
 *
 * 注: Excel本体(数MB)はコミットしない(tmp/ は .gitignore)。再ダウンロード可能な公開資料。
 */
import { readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ExcelJS from "exceljs";

const MASTERS_DIR = "tmp/masters";
const OUT = "src/lib/receipt/kaigo-service-codes.json";

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "result" in (v as object)) {
    return String((v as { result: unknown }).result ?? "");
  }
  if (typeof v === "object" && "richText" in (v as object)) {
    return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  }
  return String(v);
}

async function main(): Promise<void> {
  const files = readdirSync(MASTERS_DIR).filter((f) => f.toLowerCase().endsWith(".xlsx"));
  if (files.length === 0) {
    console.error(`${MASTERS_DIR} に .xlsx がありません。介護サービスコード表のExcelを配置してください。`);
    process.exit(1);
  }

  const map = new Map<string, string>();
  let conflicts = 0;

  for (const file of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(join(MASTERS_DIR, file));
    for (const ws of wb.worksheets) {
      if (ws.name === "表紙") continue;
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const type = cellStr(row.getCell(1).value).trim();
        const item = cellStr(row.getCell(2).value).trim();
        const name = cellStr(row.getCell(3).value).trim();
        if (!/^\d{1,2}$/.test(type) || !/^\d{1,4}$/.test(item) || !name) continue;
        const key = `${type.padStart(2, "0")}:${item.padStart(4, "0")}`;
        if (map.has(key)) {
          if (map.get(key) !== name) conflicts++;
          continue; // 先勝ち
        }
        map.set(key, name);
      }
    }
    console.log(`読込: ${file}（累計 ${map.size} コード）`);
  }

  const sorted: Record<string, string> = {};
  for (const k of Array.from(map.keys()).sort()) sorted[k] = map.get(k) as string;

  writeFileSync(OUT, JSON.stringify(sorted, null, 0) + "\n", "utf8");
  console.log(`生成: ${OUT}（${map.size} コード, 競合 ${conflicts} 件は先勝ち）`);
}

main().catch((e) => {
  console.error("ERR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
