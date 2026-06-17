/**
 * デモ用スクリプト: レセプト処理(Phase 1.5)の動作確認
 *
 * 実データ(/Users/.../レセプト/)を読み込み、パーサー→マッチング→決済対象集計
 * を一気通貫で実行し結果を表示する。
 *
 * 実行: npx tsx scripts/demo-receipt.ts
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { parseKaigoCsv } from "../src/lib/receipt/kaigo-csv";
import { parseIryouUke, xlsxSheetToRows } from "../src/lib/receipt/iryou-uke";
import {
  matchKaigoReceipts,
  matchIryouReceipts,
  summarizeKaigoMatches,
  summarizeIryouMatches,
  type ResidentForMatching,
} from "../src/lib/receipt/matcher";

const RECEIPT_DIR = "/Users/kodairakenya/Desktop/3 Step Up/介護施設向けSaaS/レセプト";

// QOLC入居者マスタ（テスト用、山田テストを実レセプトの古谷さん相当として登録）
const RESIDENTS: ResidentForMatching[] = [
  {
    id: "yamada-test",
    nameLast: "山田",
    nameFirst: "テスト",
    insuranceNumber: "0001325455",
    iryouHokenshaBangou: "100016",
    iryouHihokenshaKigou: "ま",
    iryouHihokenshaBangou: "717-6128",
    iryouHihokenshaEdaban: null,
    formerInsuranceNumbers: [],
  },
];

function hr() {
  console.log("─".repeat(70));
}

function yen(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

async function main() {
  console.log("\n");
  hr();
  console.log("  QOLC Phase 1.5 レセプト処理 デモ");
  hr();
  console.log(`  入居者マスタ: ${RESIDENTS.length}名`);
  for (const r of RESIDENTS) {
    console.log(`    - ${r.nameLast} ${r.nameFirst}`);
    console.log(`        介護保険番号: ${r.insuranceNumber}`);
    console.log(`        医療保険: ${r.iryouHokenshaBangou} / ${r.iryouHihokenshaKigou} / ${r.iryouHihokenshaBangou}`);
  }

  // ① 通所介護CSV
  hr();
  console.log("  ① 通所介護CSV (国保連 介護保険給付費請求情報)");
  hr();
  {
    const buf = readFileSync(`${RECEIPT_DIR}/KS202604通所介護.csv`);
    const parsed = parseKaigoCsv(buf);
    const matches = matchKaigoReceipts(parsed.residents, RESIDENTS);
    const summary = summarizeKaigoMatches(matches);
    console.log(`  事業所番号: ${parsed.facilityNumber}  処理年月: ${parsed.processingMonth}`);
    console.log(`  パース利用者数: ${parsed.residents.length}名`);
    console.log(`  マッチ済: ${summary.matched}名 / 未マッチ: ${summary.unmatched}名`);
    console.log(`  決済対象金額: ${yen(summary.totalChargeableAmount)}`);
    for (const m of matches.filter((x) => x.status !== "unmatched")) {
      console.log(`    → ${m.resident!.nameLast}${m.resident!.nameFirst}  被保番:${m.receipt.insuranceNumber}  本人負担:${yen(m.receipt.userBurden)}  (給付率${m.receipt.benefitRatePercent}%)`);
    }
  }

  // ② 訪問看護(介護保険)CSV
  hr();
  console.log("  ② 訪問看護〈介護保険〉CSV");
  hr();
  {
    const buf = readFileSync(`${RECEIPT_DIR}/KS202604訪問看護（介護保険）.csv`);
    const parsed = parseKaigoCsv(buf);
    const matches = matchKaigoReceipts(parsed.residents, RESIDENTS);
    const summary = summarizeKaigoMatches(matches);
    console.log(`  事業所番号: ${parsed.facilityNumber}  処理年月: ${parsed.processingMonth}`);
    console.log(`  パース利用者数: ${parsed.residents.length}名`);
    console.log(`  マッチ済: ${summary.matched}名 / 未マッチ: ${summary.unmatched}名`);
    console.log(`  決済対象金額: ${yen(summary.totalChargeableAmount)}`);
    for (const m of matches.filter((x) => x.status !== "unmatched")) {
      console.log(`    → ${m.resident!.nameLast}${m.resident!.nameFirst}  本人負担:${yen(m.receipt.userBurden)}`);
    }
  }

  // ③ 訪問看護(医療保険・国保)UKE
  hr();
  console.log("  ③ 訪問看護〈医療保険・国保〉UKE (厚労省v1.5仕様)");
  hr();
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(`${RECEIPT_DIR}/RECEIPTH.UKE 2訪問看護（医療保険＿国保）.xlsx`);
    const rows = xlsxSheetToRows(wb.worksheets[0]);
    const parsed = parseIryouUke(rows);
    const matches = matchIryouReceipts(parsed.patients, RESIDENTS);
    const summary = summarizeIryouMatches(matches);
    console.log(`  医療機関: ${parsed.institution?.name} (${parsed.institution?.code})`);
    console.log(`  パース患者数: ${parsed.patients.length}名`);
    console.log(`  マッチ済: ${summary.matched}名 / 未マッチ: ${summary.unmatched}名`);
    console.log(`  決済対象金額: ${yen(summary.totalChargeableAmount)}`);
    for (const m of matches.filter((x) => x.status !== "unmatched")) {
      const ho = m.receipt.hoken!;
      console.log(`    → ${m.resident!.nameLast}${m.resident!.nameFirst}  ← レセプト名:${m.receipt.name}`);
      console.log(`        保険者:${ho.hokenshaNumber}/${ho.kigou}/${ho.bangou}`);
      console.log(`        総額:${yen(ho.totalAmount)} → 本人負担(限度額処理後):${yen(ho.userBurden)}`);
    }
  }

  // ④ 訪問看護(医療保険・支払基金)UKE
  hr();
  console.log("  ④ 訪問看護〈医療保険・支払基金〉UKE");
  hr();
  {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(`${RECEIPT_DIR}/RECEIPTH.UKE訪問看護（医療保険＿支払基金）.xlsx`);
    const rows = xlsxSheetToRows(wb.worksheets[0]);
    const parsed = parseIryouUke(rows);
    const matches = matchIryouReceipts(parsed.patients, RESIDENTS);
    const summary = summarizeIryouMatches(matches);
    console.log(`  医療機関: ${parsed.institution?.name}`);
    console.log(`  パース患者数: ${parsed.patients.length}名 (全員生活保護=本人負担0)`);
    console.log(`  決済対象金額: ${yen(summary.totalChargeableAmount)} (公費全額負担のため0円)`);
  }

  hr();
  console.log("  ✅ デモ完了");
  console.log("");
  console.log("  ポイント:");
  console.log("   ・QOLCで複雑な計算は一切せず、レセプトの確定本人負担額を直読");
  console.log("   ・介護保険CSV: 「利用者負担額」フィールド直読");
  console.log("   ・医療保険UKE: HO「一部負担金額」直読 (限度額処理後の確定額)");
  console.log("   ・生活保護等の公費全額負担は自動的に決済対象外に");
  hr();
  console.log("");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
