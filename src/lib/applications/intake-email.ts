/**
 * 公開 intake（/api/applications）の受付自動返信メール送信＋イベント記録。
 *
 * - sendEmail は throw しない設計。本モジュールも throw せず、受付処理の
 *   成否に影響を与えない（メール失敗・スキップでも受付は成功のまま）。
 * - 送信結果は成功/スキップ/失敗を問わず application_events（kind='email_sent'）
 *   に記録する（ログ要件）。宛先はマスキングして保存する。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type SendEmailResult } from "@/lib/email/send";
import { applicationReceived } from "@/lib/email/templates";
import type { ApplicationSource } from "@/lib/applications/labels";

/**
 * メールアドレスをログ保存用にマスキングする（先頭2文字＋***＋@ドメイン）。
 * 形式が不正な場合は "***" を返す。
 * @param email 生のメールアドレス
 * @returns マスク済み文字列（例: "ta***@example.com"）
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local.slice(0, 2)}***@${domain}`;
}

/** 受付自動返信メールの送信パラメータ。 */
export interface ApplicationReceivedEmailParams {
  /** 受付済み申請の ID（受付番号としてメール本文にも記載） */
  applicationId: string;
  /** 申請種別（文面の呼称に使用） */
  source: ApplicationSource;
  /** 申請者名（宛名。null なら「お客様」） */
  applicantName: string | null;
  /** 宛先メールアドレス */
  to: string;
}

/**
 * 受付自動返信メールを送信し、結果を application_events に記録する。
 * いかなる場合も throw しない。
 * @param admin service_role クライアント（イベント記録用）
 * @param params 送信パラメータ
 * @param send テスト用に注入可能な送信関数（省略時は sendEmail）
 * @returns 送信結果（呼び出し側での利用は任意）
 */
export async function sendApplicationReceivedEmail(
  admin: SupabaseClient,
  params: ApplicationReceivedEmailParams,
  send: typeof sendEmail = sendEmail
): Promise<SendEmailResult> {
  let result: SendEmailResult;
  try {
    const tpl = applicationReceived({
      source: params.source,
      applicantName: params.applicantName,
      caseNumber: params.applicationId,
    });
    result = await send({ to: params.to, subject: tpl.subject, text: tpl.text });
  } catch (e) {
    // send は throw しない契約だが、万一に備えて握りつぶす
    result = { sent: false, skipped: false, error: e instanceof Error ? e.message : String(e) };
  }

  try {
    await admin.from("application_events").insert({
      application_id: params.applicationId,
      actor_id: null, // システム送信
      kind: "email_sent",
      detail: {
        to: maskEmail(params.to),
        template: "application_received",
        sent: result.sent,
        skipped: result.skipped,
        ...(result.error ? { error: result.error } : {}),
      },
    });
  } catch (e) {
    // 記録失敗も本流に影響させない
    console.error("[intake-email] email_sent イベントの記録に失敗しました:", e);
  }

  return result;
}
