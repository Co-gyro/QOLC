"use client";

import type { JSX } from "react";
import type { ContactForm } from "@/lib/applications/schema";

/** フィールドキーごとのエラーメッセージ集合。 */
export type ContactFieldErrors = Partial<Record<keyof ContactForm, string>>;

/** 1項目分のラベル＋ヒント＋エラー表示を伴うフィールドラッパー（ApplyForm と同形）。 */
export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="apply-form-group">
      <div className="apply-form-label">
        {label} {required && <span className="apply-form-required">必須</span>}
      </div>
      {children}
      {error ? (
        <div className="apply-form-error">{error}</div>
      ) : hint ? (
        <div className="apply-form-hint">{hint}</div>
      ) : null}
    </div>
  );
}

/**
 * お客様情報セクション（お名前・ご所属・メール・電話）。
 * @param form 現在のフォーム値
 * @param errors フィールド別エラー
 * @param set 値更新ハンドラ
 */
export function CustomerFields({
  form,
  errors,
  set,
}: {
  form: ContactForm;
  errors: ContactFieldErrors;
  set: <K extends keyof ContactForm>(key: K, value: ContactForm[K]) => void;
}): JSX.Element {
  return (
    <>
      <div className="apply-form-section" style={{ marginTop: 0 }}>
        お客様情報
      </div>
      <Field label="お名前" required hint="全角100文字以内" error={errors.name}>
        <input
          className="apply-form-input"
          type="text"
          placeholder="例：山田 太郎"
          maxLength={100}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
        />
      </Field>
      <Field label="ご所属（施設名・会社名など）" hint="任意。200文字以内" error={errors.org}>
        <input
          className="apply-form-input"
          type="text"
          placeholder="例：サンプルケア有料老人ホーム東京"
          maxLength={200}
          value={form.org ?? ""}
          onChange={(e) => set("org", e.target.value)}
        />
      </Field>
      <Field
        label="メールアドレス"
        required
        hint="半角英数字。ご回答のご連絡に使用します"
        error={errors.email}
      >
        <input
          className="apply-form-input"
          type="email"
          placeholder="sample@example.com"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </Field>
      <Field
        label="電話番号"
        hint="任意。半角数字+ハイフン（例：03-1234-5678）"
        error={errors.phone}
      >
        <input
          className="apply-form-input"
          type="tel"
          placeholder="03-1234-5678"
          maxLength={13}
          style={{ maxWidth: 220 }}
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
        />
      </Field>
    </>
  );
}
