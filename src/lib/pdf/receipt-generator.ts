/**
 * 領収書PDF生成
 *
 * @react-pdf/renderer で A4 PDF を生成する。
 * フォントは public/fonts/NotoSansJP-Regular.ttf を埋め込む想定。
 *
 * 注: フォントファイルは別途配置が必要。フォントなしでも生成は動くが日本語が□表示になる。
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

// フォント登録（ファイルが存在しない場合はフォールバック）
const FONT_NAME = "NotoSansJP";
let fontRegistered = false;
function ensureFontRegistered(): void {
  if (fontRegistered) return;
  try {
    Font.register({
      family: FONT_NAME,
      src: process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/fonts/NotoSansJP-Regular.ttf`
        : "/fonts/NotoSansJP-Regular.ttf",
    });
    fontRegistered = true;
  } catch {
    // 開発環境でフォント未配置でも処理は続行
  }
}

export interface ReceiptServiceLine {
  providerName: string;
  serviceName: string;
  amount: number;
}

export interface ReceiptInput {
  facilityName: string;
  facilityAddress?: string;
  residentName: string;
  periodStart: string; // YYYY/MM/DD
  periodEnd: string;
  services: ReceiptServiceLine[];
  totalAmount: number;
  issuedAt: string; // YYYY/MM/DD
  issuerName: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT_NAME,
    padding: 40,
    fontSize: 11,
  },
  title: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  meta: {
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metaLabel: {
    width: 80,
    color: "#666",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #333",
    borderTop: "1px solid #333",
    backgroundColor: "#F0F9F4",
    padding: 6,
    marginTop: 12,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "0.5px solid #E0DDD8",
    padding: 6,
  },
  colProvider: { flex: 2 },
  colService: { flex: 3 },
  colAmount: { flex: 1, textAlign: "right" },
  total: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingRight: 6,
  },
  totalLabel: { fontSize: 13, marginRight: 12 },
  totalValue: { fontSize: 16, fontWeight: "bold" },
  footer: {
    marginTop: 40,
    fontSize: 10,
    color: "#666",
  },
});

/** 3桁区切り */
export function formatYen(n: number): string {
  return `¥${Math.floor(n).toLocaleString("ja-JP")}`;
}

/** 領収書 PDF を React PDF コンポーネントとして構築 */
export function ReceiptDocument(input: ReceiptInput): React.ReactElement {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      React.createElement(Text, { style: styles.title }, "領収書"),
      React.createElement(
        View,
        { style: styles.meta },
        metaRow("施設", input.facilityName),
        input.facilityAddress ? metaRow("住所", input.facilityAddress) : null,
        metaRow("入居者", input.residentName),
        metaRow("対象期間", `${input.periodStart} 〜 ${input.periodEnd}`)
      ),
      React.createElement(
        View,
        { style: styles.tableHeader },
        React.createElement(Text, { style: styles.colProvider }, "提供者"),
        React.createElement(Text, { style: styles.colService }, "サービス"),
        React.createElement(Text, { style: styles.colAmount }, "金額")
      ),
      ...input.services.map((s, idx) =>
        React.createElement(
          View,
          { key: idx, style: styles.tableRow },
          React.createElement(Text, { style: styles.colProvider }, s.providerName),
          React.createElement(Text, { style: styles.colService }, s.serviceName),
          React.createElement(Text, { style: styles.colAmount }, formatYen(s.amount))
        )
      ),
      React.createElement(
        View,
        { style: styles.total },
        React.createElement(Text, { style: styles.totalLabel }, "合計"),
        React.createElement(Text, { style: styles.totalValue }, formatYen(input.totalAmount))
      ),
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, null, `発行日: ${input.issuedAt}`),
        React.createElement(Text, null, `発行者: ${input.issuerName}`)
      )
    )
  );
}

function metaRow(label: string, value: string): React.ReactElement {
  return React.createElement(
    View,
    { style: styles.metaRow },
    React.createElement(Text, { style: styles.metaLabel }, label),
    React.createElement(Text, null, value)
  );
}

/**
 * 領収書PDFを生成し Uint8Array を返す。
 */
export async function generateReceiptPdf(
  input: ReceiptInput
): Promise<Uint8Array> {
  ensureFontRegistered();
  const instance = pdf(ReceiptDocument(input));
  // @react-pdf/renderer v4 は ReadableStream | Buffer を返す環境依存実装
  // ここでは Blob 経由で ArrayBuffer 化（Node/ブラウザ両対応）
  const blob = await instance.toBlob();
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * 生成した PDF を Supabase Storage の `receipts` バケットへアップロード。
 */
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
