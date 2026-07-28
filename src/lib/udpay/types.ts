/**
 * UD Payment（仮）デモ環境の型定義。
 *
 * 本デモは外部決済（USEN等）に一切接続せず、ファイルベースのストアで
 * 「請求書作成 → 登録カードへの自動課金 → 消込 → 領収書」の一連を再現する。
 */

/** 登録カードの状態（デモではマスク済み番号のみ保持し、実カード情報は扱わない） */
export interface UdpayCard {
  /** カード登録済みか */
  registered: boolean;
  /** マスク済みカード番号（例: **** **** **** 4242） */
  maskedNumber?: string;
  /** カードブランド表示名 */
  brand?: string;
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
  /** 請求明細メールの宛先 */
  email: string;
  /** 毎月の自動課金日（初回決済日ベースのアニバーサリー日、1〜28） */
  anniversaryDay: number;
  /** カード登録リンク用トークン */
  registrationToken: string;
  card: UdpayCard;
  createdAt: string;
}

/** 請求明細行（税抜単価） */
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

/** 月次請求書。month はサービス提供月（"YYYY-MM"）。課金は翌月のアニバーサリー日 */
export interface UdpayInvoice {
  id: string;
  customerId: string;
  month: string;
  lines: UdpayInvoiceLine[];
  status: "draft" | "confirmed";
  confirmedAt?: string;
  /** 請求明細メールの送信（デモでは送信済み扱いの記録のみ） */
  mailSentAt?: string;
}

/** 課金試行の記録 */
export interface UdpayChargeAttempt {
  at: string;
  result: "paid" | "failed";
  /** 失敗理由コード（例: do_not_honor） */
  reason?: string;
}

/** 課金（決済）レコード */
export interface UdpayPayment {
  id: string;
  invoiceId: string;
  customerId: string;
  /** 税込請求額（円） */
  amount: number;
  /** 課金予定日（ISO 日付 "YYYY-MM-DD"） */
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
