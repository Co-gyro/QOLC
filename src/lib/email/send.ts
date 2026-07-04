/**
 * メール送信（Resend REST API）
 *
 * - RESEND_API_KEY 未設定の環境（ローカル・プレビュー）では送信をスキップして
 *   { sent: false, skipped: true } を返す。絶対に throw せず本流（申請受付等）を壊さない。
 * - SDK は追加せず fetch で https://api.resend.com/emails に直接 POST する。
 * - 呼び出し側は送信結果を application_events（kind='email_sent'）等に必ず記録すること。
 */

/** 送信内容（テキストメールのみ。テンプレは templates.ts で生成） */
export interface SendEmailInput {
  /** 宛先メールアドレス */
  to: string;
  /** 件名 */
  subject: string;
  /** 本文（プレーンテキスト） */
  text: string;
}

/** 送信結果（イベント記録用にそのまま JSON 保存できる形） */
export interface SendEmailResult {
  /** 送信に成功したか */
  sent: boolean;
  /** キー未設定でスキップしたか */
  skipped: boolean;
  /** Resend が採番したメールID（成功時のみ） */
  id?: string;
  /** 失敗理由（失敗時のみ） */
  error?: string;
}

/** Resend API のエンドポイント */
const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** 差出人の既定値（EMAIL_FROM 環境変数で上書き可能） */
const DEFAULT_FROM = "QOLC <noreply@qolc.jp>";

/**
 * メールを1通送信する。いかなる場合も throw しない。
 * - RESEND_API_KEY 未設定 → console.warn して { sent:false, skipped:true }
 * - API エラー / ネットワーク例外 → console.error して { sent:false, skipped:false, error }
 * @param input 宛先・件名・本文
 * @param fetchFn テスト用に注入可能な fetch（省略時はグローバル fetch）
 */
export async function sendEmail(
  input: SendEmailInput,
  fetchFn: typeof fetch = fetch
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY 未設定のため送信をスキップ: to=${input.to} subject=${input.subject}`
    );
    return { sent: false, skipped: true };
  }

  const from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
  try {
    const res = await fetchFn(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
      }),
    });
    const body = (await res.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;
    if (!res.ok) {
      const error = `Resend API error ${res.status}: ${body?.message ?? "unknown"}`;
      console.error(`[email] 送信失敗: ${error}`);
      return { sent: false, skipped: false, error };
    }
    return { sent: true, skipped: false, id: body?.id };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[email] 送信例外: ${error}`);
    return { sent: false, skipped: false, error };
  }
}
