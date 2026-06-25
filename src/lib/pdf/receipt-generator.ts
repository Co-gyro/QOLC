/**
 * 利用料請求書兼領収書 PDF 生成（描画層）
 *
 * 実サンプル（参考フォルダ「レセプト」内 Type B）に準拠した A4 1ページの帳票を
 * @react-pdf/renderer で生成する。上段=「利用料請求書兼領収書」、下段=「利用料領収書(控)」。
 * 表示ロジック・ケース判定は receipt-model.ts に分離（ここは純粋な描画）。
 *
 * フォント: public/fonts/NotoSansJP-Regular.ttf を埋め込む。未配置でも生成は動くが
 * 日本語が□表示になる（NEXT_PUBLIC_APP_URL 経由でホストされたフォントを参照）。
 */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  pdf,
} from "@react-pdf/renderer";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  buildReceiptModel,
  formatYen,
  type ReceiptInput,
  type ReceiptModel,
} from "./receipt-model";

export type {
  ReceiptInput,
  ReceiptCategory,
  ReceiptProvider,
  ReceiptTaxBucket,
} from "./receipt-model";
export { formatYen, formatNumber, formatBenefit } from "./receipt-model";

const FONT_NAME = "NotoSansJP";
let fontRegistered = false;

/**
 * 日本語フォントのソースを解決する（優先順）:
 *   1. RECEIPT_FONT_PATH … ローカルTTFの絶対パス（Vercelでバンドルした場合やNode実行向け）
 *   2. NEXT_PUBLIC_APP_URL … public/fonts/ にホストしたTTFをURL参照
 *   3. 相対 "/fonts/..." … 同一オリジン配信のフォールバック
 */
function resolveFontSrc(): string {
  if (process.env.RECEIPT_FONT_PATH) return process.env.RECEIPT_FONT_PATH;
  if (process.env.NEXT_PUBLIC_APP_URL)
    return `${process.env.NEXT_PUBLIC_APP_URL}/fonts/NotoSansJP-Regular.ttf`;
  return "/fonts/NotoSansJP-Regular.ttf";
}

function ensureFontRegistered(): void {
  if (fontRegistered) return;
  try {
    Font.register({ family: FONT_NAME, src: resolveFontSrc() });
    fontRegistered = true;
  } catch {
    // 開発環境でフォント未配置でも処理は続行
  }
}

const BORDER = "#333";
const LINE = "#888";
const HEAD_BG = "#F0F9F4";

const styles = StyleSheet.create({
  page: { fontFamily: FONT_NAME, paddingVertical: 18, paddingHorizontal: 32, fontSize: 9 },
  panel: { marginBottom: 6 },
  cutLine: { borderTop: "1px dashed #999", marginVertical: 6 },
  title: { fontSize: 15, textAlign: "center", marginBottom: 2 },
  topRight: { position: "absolute", right: 0, top: 2, fontSize: 7, color: "#666", textAlign: "right" },
  // 上段: 左に宛名、右に金額ボックス
  headRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  addressBlock: { width: "48%", paddingTop: 8 },
  postal: { fontSize: 9, marginBottom: 2 },
  address: { fontSize: 9, marginBottom: 12 },
  recipient: { fontSize: 15, marginTop: 6 },
  // 金額ボックス（右上）
  amountBox: { width: "48%" },
  issuedAt: { fontSize: 8, textAlign: "right", marginBottom: 2, color: "#444" },
  boxRow: { flexDirection: "row", borderLeft: `0.7px solid ${BORDER}`, borderRight: `0.7px solid ${BORDER}`, borderBottom: `0.7px solid ${BORDER}` },
  boxRowTop: { borderTop: `0.7px solid ${BORDER}` },
  boxLabelUser: { width: "35%", padding: 3, fontSize: 8, color: "#333", borderRight: `0.5px solid ${LINE}` },
  boxValueUser: { flex: 1, padding: 3, fontSize: 8, textAlign: "right" },
  boxLabel: { width: "35%", padding: 4, fontSize: 9, backgroundColor: HEAD_BG, borderRight: `0.5px solid ${LINE}` },
  boxValueStrong: { flex: 1, padding: 4, fontSize: 12, textAlign: "right", fontWeight: "bold" },
  taxRow: { flexDirection: "row" },
  taxLabel: { width: "22%", padding: 3, fontSize: 7.5, backgroundColor: "#EEE", borderRight: `0.5px solid ${LINE}` },
  taxAmount: { flex: 1, padding: 3, fontSize: 7.5, textAlign: "right", borderRight: `0.5px solid ${LINE}` },
  taxNote: { fontSize: 6.5, color: "#666", marginTop: 1 },
  // 明細テーブル＋提供者ボックス
  midRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  itemTable: { width: "58%" },
  itemHead: { flexDirection: "row", borderTop: `0.7px solid ${BORDER}`, borderBottom: `0.7px solid ${BORDER}`, backgroundColor: HEAD_BG },
  itemHeadCell: { padding: 3, fontSize: 8, textAlign: "center" },
  itemRow: { flexDirection: "row", borderBottom: `0.4px solid ${LINE}` },
  itemRowEmpty: { flexDirection: "row", borderBottom: `0.4px solid #DDD` },
  colItem: { flex: 3, padding: 3, fontSize: 8, borderRight: `0.4px solid ${LINE}` },
  colBreak: { flex: 2, padding: 3, fontSize: 8, textAlign: "right", borderRight: `0.4px solid ${LINE}` },
  colAmount: { flex: 1.4, padding: 3, fontSize: 8, textAlign: "right" },
  providerBox: { width: "38%" },
  providerInner: { border: `0.7px solid ${BORDER}`, padding: 6, minHeight: 50 },
  providerLine: { fontSize: 8, marginBottom: 2 },
  providerTel: { fontSize: 8, textAlign: "right" },
  paymentLine: { fontSize: 8, marginTop: 8, color: "#333" },
  invoiceLine: { fontSize: 7.5, marginTop: 2, color: "#444" },
  receivedRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 },
  receivedText: { fontSize: 9 },
  stampNote: { fontSize: 7, color: "#555", marginTop: 3 },
  sealBox: { width: 70, height: 46, border: `0.7px solid ${BORDER}` },
  sealLabel: { fontSize: 7, textAlign: "center", paddingTop: 2, borderBottom: `0.4px solid ${LINE}` },
  footnote: { fontSize: 7, color: "#555", marginTop: 8 },
});

const EMPTY_ROWS = 3; // 罫線の見た目（カード決済情報の追記分を見込み2面で1ページに収める）

/** 金額ボックス（請求年月＋領収金額＋税内訳） */
function amountBox(m: ReceiptModel, amountLabel: string): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.amountBox },
    React.createElement(Text, { style: styles.issuedAt }, `発行日：${m.issuedAt}`),
    // ご利用者
    React.createElement(
      View,
      { style: [styles.boxRow, styles.boxRowTop] },
      React.createElement(Text, { style: styles.boxLabelUser }, "ご利用者"),
      React.createElement(Text, { style: styles.boxValueUser }, m.userLabel ?? "")
    ),
    // 請求年月
    React.createElement(
      View,
      { style: styles.boxRow },
      React.createElement(Text, { style: styles.boxLabel }, "請求年月"),
      React.createElement(Text, { style: styles.boxValueStrong }, m.billingMonth)
    ),
    // 領収金額（税込）
    React.createElement(
      View,
      { style: styles.boxRow },
      React.createElement(Text, { style: styles.boxLabel }, amountLabel),
      React.createElement(Text, { style: styles.boxValueStrong }, `${m.amountDisplay} 円`)
    ),
    // 税内訳
    React.createElement(
      View,
      { style: styles.boxRow },
      React.createElement(Text, { style: styles.taxLabel }, "10%対象"),
      React.createElement(Text, { style: styles.taxAmount }, formatYen(m.tax10.amount)),
      React.createElement(Text, { style: styles.taxAmount }, `(消費税 ${formatYen(m.tax10.tax)})`)
    ),
    React.createElement(
      View,
      { style: styles.boxRow },
      React.createElement(Text, { style: styles.taxLabel }, "8%対象☆"),
      React.createElement(Text, { style: styles.taxAmount }, formatYen(m.tax8.amount)),
      React.createElement(Text, { style: styles.taxAmount }, `(消費税 ${formatYen(m.tax8.tax)})`)
    ),
    m.showReducedTaxNote
      ? React.createElement(Text, { style: styles.taxNote }, "☆ 軽減税率")
      : null
  );
}

/** 明細テーブル（項目名/内訳/金額 ＋ 空行） */
function itemTable(m: ReceiptModel): React.ReactElement {
  const rows: React.ReactElement[] = [
    React.createElement(
      View,
      { key: "head", style: styles.itemHead },
      React.createElement(Text, { style: [styles.colItem, styles.itemHeadCell] }, "項目名"),
      React.createElement(Text, { style: [styles.colBreak, styles.itemHeadCell] }, "内訳"),
      React.createElement(Text, { style: [styles.colAmount, styles.itemHeadCell] }, "金額")
    ),
  ];
  m.itemRows.forEach((r, i) => {
    rows.push(
      React.createElement(
        View,
        { key: `r${i}`, style: styles.itemRow },
        React.createElement(Text, { style: styles.colItem }, r.itemName),
        React.createElement(Text, { style: styles.colBreak }, r.breakdown ?? ""),
        React.createElement(Text, { style: styles.colAmount }, r.amount ?? "")
      )
    );
  });
  for (let i = 0; i < EMPTY_ROWS; i++) {
    rows.push(
      React.createElement(
        View,
        { key: `e${i}`, style: styles.itemRowEmpty },
        React.createElement(Text, { style: styles.colItem }, " "),
        React.createElement(Text, { style: styles.colBreak }, ""),
        React.createElement(Text, { style: styles.colAmount }, "")
      )
    );
  }
  return React.createElement(View, { style: styles.itemTable }, ...rows);
}

/** 提供者ボックス（右下） */
function providerBox(m: ReceiptModel): React.ReactElement {
  const p = m.provider;
  return React.createElement(
    View,
    { style: styles.providerBox },
    React.createElement(
      View,
      { style: styles.providerInner },
      p.postalCode ? React.createElement(Text, { style: styles.providerLine }, `〒${p.postalCode}`) : null,
      p.address ? React.createElement(Text, { style: styles.providerLine }, p.address) : null,
      React.createElement(Text, { style: styles.providerLine }, p.name),
      p.tel ? React.createElement(Text, { style: styles.providerTel }, `TEL ${p.tel}`) : null
    )
  );
}

/** 領収印＋受領文（カード決済なら「クレジットカードにて領収」） */
function receivedRow(m: ReceiptModel): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.receivedRow },
    React.createElement(Text, { style: styles.receivedText }, m.receivedStatement),
    React.createElement(
      View,
      { style: styles.sealBox },
      React.createElement(Text, { style: styles.sealLabel }, "領収印")
    )
  );
}

/** 1パネル（請求書兼領収書 / 領収書控）を構築 */
function panel(
  m: ReceiptModel,
  title: string,
  amountLabel: string
): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.panel, wrap: false },
    React.createElement(Text, { style: styles.title }, title),
    m.documentNo ? React.createElement(Text, { style: styles.topRight }, `No.${m.documentNo}`) : null,
    React.createElement(
      View,
      { style: styles.headRow },
      React.createElement(
        View,
        { style: styles.addressBlock },
        m.recipientPostalCode ? React.createElement(Text, { style: styles.postal }, `〒 ${m.recipientPostalCode}`) : null,
        m.recipientAddress ? React.createElement(Text, { style: styles.address }, m.recipientAddress) : null,
        React.createElement(Text, { style: styles.recipient }, `${m.recipientName}　様`)
      ),
      amountBox(m, amountLabel)
    ),
    React.createElement(
      View,
      { style: styles.midRow },
      itemTable(m),
      providerBox(m)
    ),
    m.paymentLine ? React.createElement(Text, { style: styles.paymentLine }, m.paymentLine) : null,
    m.invoiceRegistrationNumber
      ? React.createElement(Text, { style: styles.invoiceLine }, `登録番号：${m.invoiceRegistrationNumber}`)
      : null,
    receivedRow(m),
    m.stampDutyNote ? React.createElement(Text, { style: styles.stampNote }, m.stampDutyNote) : null,
    m.footnote ? React.createElement(Text, { style: styles.footnote }, `※ ${m.footnote}`) : null
  );
}

/** 利用料請求書兼領収書 PDF を React PDF コンポーネントとして構築 */
export function ReceiptDocument(input: ReceiptInput): React.ReactElement {
  const m = buildReceiptModel(input);
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      panel(m, "利用料請求書兼領収書", "領収金額（税込）"),
      React.createElement(View, { style: styles.cutLine }),
      panel(m, "利用料領収書（控）", "領収金額（税込）")
    )
  );
}

/** 請求書兼領収書PDFを生成し Uint8Array を返す。 */
export async function generateReceiptPdf(
  input: ReceiptInput
): Promise<Uint8Array> {
  ensureFontRegistered();
  const instance = pdf(ReceiptDocument(input));
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/** 生成した PDF を Supabase Storage の `receipts` バケットへアップロード。 */
export async function uploadReceiptPdf(
  buffer: Uint8Array,
  path: string
): Promise<{ path: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.storage
    .from("receipts")
    .upload(path, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (error) {
    throw new Error(`PDF アップロード失敗: ${error.message}`);
  }
  return { path: data.path };
}
