/**
 * 住み替え相談フォーム（jcb_consult）の送信前バリデーション（純ロジック）
 *
 * フォームは非制御フィールドを DOM 走査で収集する方式のため、
 * 必須項目の欠落チェックを payload に対して行う。
 */

/** 必須チェックの対象キーとエラーメッセージ */
const REQUIRED_CHECKS: Array<{ key: string; message: string }> = [
  { key: "timing", message: "「住み替えの検討時期」を選択してください" },
  { key: "concerns", message: "「お困りごと」を1つ以上選択してください" },
  { key: "contact_method", message: "「ご希望の連絡方法」を選択してください" },
];

/**
 * 相談フォームの payload に対する必須チェック。
 * @param payload collectPayload の結果（name キー → 値）
 * @returns エラーメッセージ配列（空なら妥当）
 */
export function validateConsultPayload(payload: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const { key, message } of REQUIRED_CHECKS) {
    const v = payload[key];
    if (typeof v !== "string" || v.trim() === "") errors.push(message);
  }
  return errors;
}
