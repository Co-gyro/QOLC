/**
 * USEN 加盟店マスタ登録CSVの生成（純ロジック）
 *
 * 仕様: 「ユニバーサルデベロップメント様向け_加盟店マスタ登録フォーマット 2.xlsx」
 * （統合ファイルフォーマット・2026-04-28版・全19項目）
 * - Shift-JIS / CRLF / カンマ区切り / 全項目ダブルクォート囲み / ヘッダ行必須
 * - ファイル名はフォーマット60行目の規定どおり「UD_YYYYMMDD.csv」（名称サフィックスなし）
 * - DINERS系の列は存在しない（旧実例CSV由来の21列は誤り — 2026-09-17 USEN古賀氏指摘で是正）
 * - QOLCの登録パターンは「VM+JCB登録」（銀聯・QR・電子マネーは未使用＝空欄）
 * - 運用（USEN古賀さん 2026-07-22 連絡）: Google Drive へ格納＋メール連絡。
 *   当日15時までの依頼は当日処理、以降は翌営業日処理。
 *   ⚠️ カード会社側のPOS登録がすべて完了してから連携すること（2026-09 USEN指摘）。
 */
import Encoding from "encoding-japanese";
import type { DateParts } from "@/lib/workflow/utils";

/** ヘッダ（フォーマット2026-04-28版の項番1〜19と完全一致） */
export const USEN_MASTER_HEADER: readonly string[] = [
  "登録識別子",
  "モールコード",
  "売上処理用加盟店名称",
  "レシート表示用加盟店名称",
  "銀聯用加盟店名称",
  "銀聯用加盟店所在地",
  "端末識別番号",
  "VM支払区分",
  "SAISON加盟店番号",
  "SSNB加盟店番号",
  "JCB支払区分",
  "JCB加盟店番号",
  "銀聯加盟店番号",
  "加盟店ID",
  "MerchantID",
  "店舗コード",
  "加盟店住所",
  "加盟店印字TEL",
  "利用可能サービス",
];

/** 固定値（VM+JCB・一括のみ・クレジットのみ） */
export const USEN_FIXED = {
  registerId: "UD",
  paymentDivision: "10", // 一括のみ
  service: "credit",
} as const;

/** 生成に必要な入力（案件の採番・UD追記・審査結果から組み立てる） */
export interface UsenMasterInput {
  /** モールコード（採番値。例: A3F2） */
  mallCode: string;
  /** 端末識別番号（採番値。13桁） */
  terminalId: string;
  /** 売上処理用加盟店名称（半角英数25文字以内。UD追記の店舗名アルファベット） */
  salesName: string;
  /** レシート表示用加盟店名称（施設名。64文字以内） */
  receiptName: string;
  /** SAISON加盟店番号（審査結果の登録値） */
  saisonMerchantCode: string;
  /** JCB加盟店番号（審査結果の1本＝区分11で登録型・都度型を包含。実例は店子14桁） */
  jcbMerchantCode: string;
}

/**
 * 生成前の検証。不足項目の日本語メッセージを返す（空配列=OK）。
 * どの工程を先に済ませるべきかが分かる文言にする。
 */
export function validateUsenMaster(input: Partial<UsenMasterInput>): string[] {
  const errors: string[] = [];
  if (!input.mallCode || !input.terminalId) {
    errors.push("採番が未実施です（登録手続きの「採番」を先に実行してください）");
  }
  if (!input.salesName) {
    errors.push("店舗名アルファベットが未入力です（UD追記情報の申請書用補足）");
  } else if (!/^[A-Z0-9 ]{1,25}$/.test(input.salesName)) {
    errors.push("店舗名アルファベットは半角英大文字・数字・スペース25文字以内にしてください");
  }
  if (!input.receiptName) {
    errors.push("施設名（レシート表示用名称）がありません");
  } else if (input.receiptName.length > 64) {
    errors.push("レシート表示用名称が64文字を超えています");
  }
  if (!input.saisonMerchantCode) {
    errors.push("SAISON加盟店番号が未登録です（審査結果の登録を先に行ってください）");
  }
  if (!input.jcbMerchantCode) {
    errors.push("JCB加盟店番号が未登録です（審査結果の登録を先に行ってください）");
  }
  return errors;
}

/** 1フィールドをダブルクォートで囲む（内部の " は "" にエスケープ） */
function quote(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

/** CSV文字列（ヘッダ＋1行・CRLF・全項目クォート）を組み立てる */
export function buildUsenMasterCsv(input: UsenMasterInput): string {
  const row: string[] = [
    USEN_FIXED.registerId,
    input.mallCode,
    input.salesName,
    input.receiptName,
    "", // 銀聯用加盟店名称
    "", // 銀聯用加盟店所在地
    input.terminalId,
    USEN_FIXED.paymentDivision, // VM支払区分
    input.saisonMerchantCode,
    "", // SSNB加盟店番号
    USEN_FIXED.paymentDivision, // JCB支払区分
    input.jcbMerchantCode,
    "", // 銀聯加盟店番号
    "", // 加盟店ID
    "", // MerchantID
    "", // 店舗コード
    "", // 加盟店住所
    "", // 加盟店印字TEL
    USEN_FIXED.service,
  ];
  const lines = [USEN_MASTER_HEADER.map(quote).join(","), row.map(quote).join(",")];
  return lines.join("\r\n") + "\r\n";
}

/** ファイル名（フォーマット60行目の規定: UD_YYYYMMDD.csv。名称サフィックスは付けない） */
export function buildUsenFilename(parts: DateParts): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `UD_${parts.year}${p(parts.month)}${p(parts.day)}.csv`;
}

/** CSV文字列を Shift-JIS のバイト列へ（ダウンロード用） */
export function toSjisBytes(text: string): Uint8Array<ArrayBuffer> {
  const unicodeArray = Encoding.stringToCode(text);
  const sjisArray = Encoding.convert(unicodeArray, { to: "SJIS", from: "UNICODE" });
  return new Uint8Array(sjisArray);
}
