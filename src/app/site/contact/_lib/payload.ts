/**
 * 一般お問い合わせフォーム（/site/contact）の送信ペイロード構築（純関数）。
 * フォーム値を公開 intake API（POST /api/applications）の入力形式へマップする。
 * コンポーネントから分離してユニットテスト可能にしている。
 */
import type { ContactForm } from "@/lib/applications/schema";
import type { ApplicationIntakeInput } from "@/lib/applications/schema";

/** お問い合わせ種別の選択肢（フォームのラジオボタンに対応）。 */
export const CONTACT_CATEGORIES = [
  "サービスについて",
  "導入のご相談",
  "取材・提携",
  "その他",
] as const;

/** お問い合わせ種別。 */
export type ContactCategory = (typeof CONTACT_CATEGORIES)[number];

/**
 * フォーム値から /api/applications への送信ボディを組み立てる。
 * - applicant_name=お名前 / applicant_org=ご所属 / message=お問い合わせ内容 にマップ
 * - 任意項目（ご所属・電話）は空文字なら送信しない（undefined）
 * - 種別（category）はフォーム全項目とともに payload に保持する
 * @param form 検証済みのフォーム値（contactFormSchema 準拠）
 * @param category お問い合わせ種別
 * @returns intake API の入力（applicationIntakeSchema 準拠）
 */
export function buildContactIntakeBody(
  form: ContactForm,
  category: ContactCategory
): ApplicationIntakeInput {
  return {
    source: "contact",
    applicant_name: form.name,
    applicant_org: form.org && form.org.trim() ? form.org : undefined,
    applicant_email: form.email,
    applicant_phone: form.phone && form.phone.trim() ? form.phone : undefined,
    message: form.message,
    payload: {
      category,
      name: form.name,
      org: form.org ?? "",
      email: form.email,
      phone: form.phone ?? "",
      message: form.message,
    },
  };
}
