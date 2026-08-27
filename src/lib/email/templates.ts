/**
 * メール文面テンプレート（純関数・日本語）
 *
 * DBアクセス・環境変数参照を行わない。宛名や案件番号などの可変値はすべて
 * 引数で受け取り、{ subject, text } を返す。送信は send.ts の sendEmail で行う。
 */
import type { ApplicationSource } from "@/lib/applications/labels";
import { SOURCE_LABELS } from "@/lib/applications/labels";
import type { MerchantApplyType } from "@/lib/applications/apply-type";

/** 生成されたメール文面（sendEmail にそのまま渡せる形） */
export interface EmailTemplate {
  subject: string;
  text: string;
}

/**
 * 送信ブランド。
 * qolc=介護施設向け（QOLC）/ ud=一般の店舗・事業所向け（介護の文脈を出さない）
 * 加盟店申請の区分（applyType）に対応する。
 */
export type EmailBrand = "qolc" | "ud";

/** 問い合わせ・返信先の統一アドレス（送信元アドレスと同一） */
export const SUPPORT_EMAIL = "support@uni-dev.jp";

/**
 * 件名の先頭に付ける差出人表記。
 * 件名は短く保ちたいので「株式会社」は省く（正式商号は署名側に出す）。
 */
const SUBJECT_PREFIX: Record<EmailBrand, string> = {
  qolc: "【QOLC】",
  ud: "【ユニバーサル・デベロップメント】",
};

/** メール差出人の表示名（send.ts の fromName に渡す） */
export const FROM_NAME: Record<EmailBrand, string> = {
  qolc: "QOLC（コルク）運営事務局",
  ud: "株式会社ユニバーサル・デベロップメント",
};

/** 署名（ブランド別） */
const SIGNATURES: Record<EmailBrand, string> = {
  qolc: [
    "──────────────────────",
    "QOLC（コルク）運営事務局",
    "株式会社ユニバーサル・デベロップメント",
    `お問い合わせ: ${SUPPORT_EMAIL}`,
    "https://www.qolc.jp",
    "──────────────────────",
  ].join("\n"),
  ud: [
    "──────────────────────",
    "株式会社ユニバーサル・デベロップメント",
    `お問い合わせ: ${SUPPORT_EMAIL}`,
    "https://uni-dev.jp",
    "──────────────────────",
  ].join("\n"),
};

/** 返信を促す案内文（support@ は実在の受信箱なので送信専用にはしない） */
const REPLY_NOTICE = `ご不明な点は本メールにそのままご返信いただくか、${SUPPORT_EMAIL} までお問い合わせください。`;

/**
 * 加盟店申請の区分から送信ブランドを決める。
 * 一般の店舗・事業所向けの申請には QOLC（介護向けサービス名）を出さない。
 * @param type 申請区分
 */
export function brandOfApplyType(type: MerchantApplyType): EmailBrand {
  return type === "general" ? "ud" : "qolc";
}

/** 宛名行を生成する（名前がなければ「お客様」） */
function honorific(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  return n ? `${n} 様` : "お客様";
}

/**
 * 受付自動返信メール（公開フォーム送信直後に送る）。
 * @param params.source 申請種別（文面の呼称を SOURCE_LABELS から解決）
 * @param params.applicantName 申請者名（省略時は「お客様」）
 * @param params.caseNumber 案件番号（管理用ID等。省略時は行ごと省く）
 * @param params.brand 送信ブランド（省略時は qolc）
 */
export function applicationReceived(params: {
  source: ApplicationSource;
  applicantName?: string | null;
  caseNumber?: string | null;
  brand?: EmailBrand;
}): EmailTemplate {
  const brand = params.brand ?? "qolc";
  const label = SOURCE_LABELS[params.source];
  const caseLine = params.caseNumber ? `\n受付番号: ${params.caseNumber}\n` : "\n";
  // ud ブランドでは「QOLCへ」という宛先表現を出さない（介護以外のお客様向け）
  const thanks =
    brand === "qolc"
      ? `このたびはQOLCへ${label}をお寄せいただき、ありがとうございます。\n`
      : `このたびは${label}をお寄せいただき、ありがとうございます。\n`;
  return {
    subject: `${SUBJECT_PREFIX[brand]}${label}を受け付けました`,
    text:
      `${honorific(params.applicantName)}\n\n` +
      thanks +
      `以下の内容で受け付けました。担当者より2営業日以内にご連絡いたします。\n` +
      caseLine +
      `${REPLY_NOTICE}\n` +
      `お心当たりがない場合は、恐れ入りますが本メールを破棄してください。\n\n` +
      SIGNATURES[brand],
  };
}

/**
 * 審査通過のご案内メール（加盟店審査の承認後に送る）。
 * @param params.applicantName ご担当者名
 * @param params.merchantName 加盟店（事業者）名。省略時は文面から省く
 * @param params.caseNumber 受付番号（省略可）
 * @param params.brand 送信ブランド（省略時は qolc）
 */
export function reviewApproved(params: {
  applicantName?: string | null;
  merchantName?: string | null;
  caseNumber?: string | null;
  brand?: EmailBrand;
}): EmailTemplate {
  const brand = params.brand ?? "qolc";
  const merchantLine = params.merchantName
    ? `「${params.merchantName}」の加盟店審査が完了し、ご利用いただけることになりました。\n`
    : `加盟店審査が完了し、ご利用いただけることになりました。\n`;
  const caseLine = params.caseNumber ? `受付番号: ${params.caseNumber}\n\n` : "\n";
  const supportLine =
    brand === "qolc"
      ? `初期設定はQOLC担当者がサポートいたします。\n`
      : `初期設定は担当者がサポートいたします。\n`;
  return {
    subject: `${SUBJECT_PREFIX[brand]}加盟店審査通過のご案内`,
    text:
      `${honorific(params.applicantName)}\n\n` +
      `お待たせいたしました。\n` +
      merchantLine +
      caseLine +
      `このあと、ログイン用アカウントのご案内メールを別途お送りします。\n` +
      supportLine +
      `${REPLY_NOTICE}\n\n` +
      SIGNATURES[brand],
  };
}

/**
 * アカウント発行・ログイン案内メール（招待リンク付き）。
 * @param params.recipientName 宛名（省略時は「お客様」）
 * @param params.portalName ポータル名（例: 「施設ポータル」「提供者ポータル」）
 * @param params.inviteUrl 招待（初回ログイン）URL
 * @param params.expiresInDays 招待リンクの有効日数（省略時は記載しない）
 */
export function accountInvite(params: {
  recipientName?: string | null;
  portalName: string;
  inviteUrl: string;
  expiresInDays?: number;
}): EmailTemplate {
  const expireLine =
    params.expiresInDays != null
      ? `※ このリンクの有効期限は${params.expiresInDays}日間です。期限が切れた場合は再発行をご依頼ください。\n\n`
      : "\n";
  return {
    subject: `【QOLC】${params.portalName}のアカウントを発行しました`,
    text:
      `${honorific(params.recipientName)}\n\n` +
      `QOLC ${params.portalName}のアカウントを発行しました。\n` +
      `以下のリンクからパスワードを設定のうえ、ログインしてください。\n\n` +
      `${params.inviteUrl}\n\n` +
      expireLine +
      `${REPLY_NOTICE}\n\n` +
      SIGNATURES.qolc,
  };
}
