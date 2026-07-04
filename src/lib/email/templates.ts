/**
 * メール文面テンプレート（純関数・日本語）
 *
 * DBアクセス・環境変数参照を行わない。宛名や案件番号などの可変値はすべて
 * 引数で受け取り、{ subject, text } を返す。送信は send.ts の sendEmail で行う。
 */
import type { ApplicationSource } from "@/lib/applications/labels";
import { SOURCE_LABELS } from "@/lib/applications/labels";

/** 生成されたメール文面（sendEmail にそのまま渡せる形） */
export interface EmailTemplate {
  subject: string;
  text: string;
}

/** 署名（全テンプレ共通） */
const SIGNATURE = [
  "──────────────────────",
  "QOLC（コルク）運営事務局",
  "ユニバーサルデベロップメント株式会社",
  "https://www.qolc.jp",
  "──────────────────────",
].join("\n");

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
 */
export function applicationReceived(params: {
  source: ApplicationSource;
  applicantName?: string | null;
  caseNumber?: string | null;
}): EmailTemplate {
  const label = SOURCE_LABELS[params.source];
  const caseLine = params.caseNumber ? `\n受付番号: ${params.caseNumber}\n` : "\n";
  return {
    subject: `【QOLC】${label}を受け付けました`,
    text:
      `${honorific(params.applicantName)}\n\n` +
      `このたびはQOLCへ${label}をお寄せいただき、ありがとうございます。\n` +
      `以下の内容で受け付けました。担当者より2営業日以内にご連絡いたします。\n` +
      caseLine +
      `本メールは送信専用です。お心当たりがない場合は、恐れ入りますが本メールを破棄してください。\n\n` +
      SIGNATURE,
  };
}

/**
 * 審査通過のご案内メール（加盟店審査の承認後に送る）。
 * @param params.applicantName ご担当者名
 * @param params.merchantName 加盟店（事業者）名。省略時は文面から省く
 * @param params.caseNumber 受付番号（省略可）
 */
export function reviewApproved(params: {
  applicantName?: string | null;
  merchantName?: string | null;
  caseNumber?: string | null;
}): EmailTemplate {
  const merchantLine = params.merchantName
    ? `「${params.merchantName}」の加盟店審査が完了し、ご利用いただけることになりました。\n`
    : `加盟店審査が完了し、ご利用いただけることになりました。\n`;
  const caseLine = params.caseNumber ? `受付番号: ${params.caseNumber}\n\n` : "\n";
  return {
    subject: "【QOLC】加盟店審査通過のご案内",
    text:
      `${honorific(params.applicantName)}\n\n` +
      `お待たせいたしました。\n` +
      merchantLine +
      caseLine +
      `このあと、ログイン用アカウントのご案内メールを別途お送りします。\n` +
      `初期設定はQOLC担当者がサポートいたしますので、ご不明な点はお気軽にご連絡ください。\n\n` +
      SIGNATURE,
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
      `操作にお困りの場合は、本メール記載の運営事務局までご連絡ください。\n\n` +
      SIGNATURE,
  };
}
