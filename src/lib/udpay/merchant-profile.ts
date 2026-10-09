/**
 * 帳票（請求書・領収証）に載せる発行元＝加盟店の情報。
 * デモはランサイド様の指定フォーマット（2026-10-01 受領）の記載内容を固定値で持つ。
 * 本番では加盟店ごとに DB（加盟店マスタ）から読み込む。
 */
export interface MerchantProfile {
  /** 会社名 */
  name: string;
  postalCode: string;
  /** 住所1行目（請求書の表記） */
  address1: string;
  /** 住所2行目（建物名） */
  address2: string;
  /** 住所1行目（領収証の表記） */
  receiptAddress1: string;
  tel: string;
  /** 担当者 */
  contact: string;
  /** 適格請求書発行事業者の登録番号 */
  registrationNumber: string;
  /** ロゴ画像のパス（public 配下） */
  logoPath: string;
  /**
   * 顧客に設定できる決済日（加盟店ごとの設定）。
   * ランサイド様は 15日・28日 を候補として税理士に相談中（2026-10-08 回答）。
   * どちらか一方に絞る場合はこの配列を1件にするだけでよい。
   */
  chargeDays: number[];
}

/** デモの発行元（株式会社ランサイド） */
export const DEMO_MERCHANT: MerchantProfile = {
  name: "株式会社ランサイド",
  postalCode: "100-0006",
  address1: "東京都千代田区有楽町2-7-1",
  address2: "有楽町イトシア１２階",
  receiptAddress1: "東京都千代田区有楽町二丁目７番１号",
  tel: "03-6860-4610",
  contact: "永村隆司",
  registrationNumber: "T6010001241594",
  logoPath: "/udpay/runside-logo.png",
  chargeDays: [15, 28],
};
