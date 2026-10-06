/**
 * UD Payment（仮）デモ環境の型定義。
 *
 * 本デモは外部決済（USEN等）に一切接続せず、デモ用ストアで
 * 「請求作成 → 課金予約 → 一括実行（決済確定・メール送付）→ 決済日に自動課金 → 入金済み」
 * の一連を再現する（2026-09-30 ランサイド様要望 1〜7 を反映）。
 */

/** 登録カードの状態（デモではマスク済み番号のみ保持し、実カード情報は扱わない） */
export interface UdpayCard {
  /** カード登録済みか */
  registered: boolean;
  /** マスク済みカード番号（例: **** **** **** 4242） */
  maskedNumber?: string;
  /** カードブランド表示名 */
  brand?: string;
  /** 有効期限 "YYYYMM"（本番は USEN 会員情報取得で取得） */
  expireYm?: string;
  /** 登録日時（ISO 8601） */
  registeredAt?: string;
  /** デモ用: 次回課金を一度だけ与信落ちさせるフラグ */
  demoFailOnce?: boolean;
}

/** 請求先顧客（ランサイドの顧客＝歯科医院を想定） */
export interface UdpayCustomer {
  id: string;
  /** 医院名・会社名 */
  name: string;
  /** 担当者名 */
  contactName: string;
  /** 請求メールの宛先（To・主） */
  email: string;
  /** 請求メールの宛先（CC） */
  cc: string[];
  /** 毎月の決済日（1〜28） */
  anniversaryDay: number;
  /** 備考（請求書・メールに載せない社内向けメモ） */
  note?: string;
  /** カード登録リンク用トークン */
  registrationToken: string;
  /** カード登録リンクをメールで送った日時 */
  registrationMailSentAt?: string;
  card: UdpayCard;
  createdAt: string;
}

/** 請求明細行（税抜単価。マイナスは値引き） */
export interface UdpayInvoiceLine {
  id: string;
  /** 摘要（例: 歯科医院支援サポート料金、交通費 実費） */
  description: string;
  quantity: number;
  /** 税抜単価（円） */
  unitPrice: number;
  /** 税率（%） */
  taxRate: number;
}

/**
 * 請求の状態。
 * draft=下書き / reserved=課金予約（担当者・メール未送付） /
 * confirmed=決済確定（承認者の一括実行でメール送付済み。以降の状態は決済側で持つ）
 */
export type UdpayInvoiceStatus = "draft" | "reserved" | "confirmed";

/** 月次請求書。month はサービス提供月（"YYYY-MM"）。決済は翌月の決済日 */
export interface UdpayInvoice {
  id: string;
  customerId: string;
  month: string;
  lines: UdpayInvoiceLine[];
  status: UdpayInvoiceStatus;
  reservedAt?: string;
  confirmedAt?: string;
  /** 請求メールの件名（未指定なら既定の件名） */
  mailSubject?: string;
  /** 請求メールの追記コメント（金額・明細・決済日の行は自動差し込み） */
  mailComment?: string;
  /** 請求メールの送信日時（デモでは送信済み扱いの記録のみ） */
  mailSentAt?: string;
  /** 決済確定を取り消した日時（訂正メールの案内表示に使う） */
  confirmationCancelledAt?: string;
}

/** 課金試行の記録 */
export interface UdpayChargeAttempt {
  at: string;
  result: "paid" | "failed";
  /** 失敗理由コード（例: do_not_honor） */
  reason?: string;
}

/** 課金（決済）レコード。決済確定（一括実行）で作られる */
export interface UdpayPayment {
  id: string;
  invoiceId: string;
  customerId: string;
  /** 税込請求額（円） */
  amount: number;
  /** 課金日（ISO 日付 "YYYY-MM-DD"。予定日を過ぎて確定した場合は翌日） */
  scheduledDate: string;
  status: "scheduled" | "paid" | "failed";
  attempts: UdpayChargeAttempt[];
  paidAt?: string;
}

/** ストア全体 */
export interface UdpayStore {
  customers: UdpayCustomer[];
  invoices: UdpayInvoice[];
  payments: UdpayPayment[];
  /** シードデータのバージョン（シード更新時の作り直し判定用） */
  seedVersion: number;
}
