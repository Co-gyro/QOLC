"use client";

import { useState } from "react";
import type { JSX } from "react";
import { contactFormSchema, type ContactForm } from "@/lib/applications/schema";
import {
  CONTACT_CATEGORIES,
  type ContactCategory,
  buildContactIntakeBody,
} from "../_lib/payload";
import { CustomerFields, Field, type ContactFieldErrors } from "./ContactFormFields";

/** フォームの初期値。 */
const INITIAL: ContactForm = {
  name: "",
  org: "",
  email: "",
  phone: "",
  message: "",
};

/**
 * 一般お問い合わせフォーム本体。クライアント側 zod 検証・二重送信防止・
 * 送信成功時に onComplete で完了表示へ切替（ApplyForm と同じ流儀）。
 * @param onComplete 送信成功時のコールバック
 */
export default function ContactFormView({
  onComplete,
}: {
  onComplete: () => void;
}): JSX.Element {
  const [form, setForm] = useState<ContactForm>(INITIAL);
  const [category, setCategory] = useState<ContactCategory>("サービスについて");
  const [errors, setErrors] = useState<ContactFieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** 入力値を更新するヘルパー。 */
  function set<K extends keyof ContactForm>(key: K, value: ContactForm[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** 送信処理。検証→API呼び出し→完了切替。 */
  async function handleSubmit(): Promise<void> {
    setSubmitError(null);
    const result = contactFormSchema.safeParse(form);
    if (!result.success) {
      const next: ContactFieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ContactForm | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildContactIntakeBody(result.data, category)),
      });
      if (!res.ok) {
        setSubmitError("送信に失敗しました。入力内容をご確認のうえ、再度お試しください。");
        return;
      }
      onComplete();
    } catch {
      setSubmitError("通信エラーが発生しました。時間をおいて再度お試しください。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="apply-form">
        <CustomerFields form={form} errors={errors} set={set} />

        <div className="apply-form-section">お問い合わせ内容</div>
        <Field label="お問い合わせ種別" required hint="最も近いものをお選びください">
          <div className="apply-form-radio-group">
            {CONTACT_CATEGORIES.map((v) => (
              <label
                key={v}
                className={`apply-form-radio${category === v ? " selected" : ""}`}
              >
                <div className="apply-form-radio-dot" />
                <input
                  type="radio"
                  name="category"
                  checked={category === v}
                  onChange={() => setCategory(v)}
                />{" "}
                {v}
              </label>
            ))}
          </div>
        </Field>
        <Field
          label="お問い合わせ内容"
          required
          hint="500文字以内。できるだけ具体的にご記入いただくとご案内がスムーズです"
          error={errors.message}
        >
          <textarea
            className="apply-form-input"
            rows={6}
            maxLength={500}
            placeholder="例：入居者50名の施設で導入を検討しています。初期費用と導入までの期間を教えてください。"
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
          />
        </Field>
      </div>

      {submitError && <p className="apply-submit-error">{submitError}</p>}

      <div className="apply-actions">
        <button
          type="button"
          className="btn-green"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "送信中..." : "この内容で送信する →"}
        </button>
      </div>
    </>
  );
}
