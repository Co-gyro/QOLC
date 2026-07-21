"use client";

import { useState } from "react";
import type { JSX } from "react";
import {
  merchantApplyFormSchema,
  type MerchantApplyForm,
} from "@/lib/applications/schema";

/** ご連絡希望時間帯の選択肢。 */
const CONTACT_TIMES = ["いつでも", "午前中", "午後"] as const;

/** フォームの初期値。 */
const INITIAL: MerchantApplyForm = {
  corpType: "法人",
  corpName: "",
  corpNameKana: "",
  corporateNumber: "",
  postalCode: "",
  address: "",
  phone: "",
  repLastName: "",
  repFirstName: "",
  repLastNameKana: "",
  repFirstNameKana: "",
  repBirthdate: "",
  facilityName: "",
  facilityNameKana: "",
  facilityPostalCode: "",
  facilityAddress: "",
  facilityPhone: "",
  contactLastName: "",
  contactFirstName: "",
  contactEmail: "",
  contactPhone: "",
  contactTime: "いつでも",
  note: "",
};

/** フィールドキーごとのエラーメッセージ集合。 */
type FieldErrors = Partial<Record<keyof MerchantApplyForm, string>>;

/**
 * 加盟店申請フォーム本体。クライアント側 zod 検証・二重送信防止・
 * 送信成功時に onComplete で完了表示へ切替。
 * @param onComplete 送信成功時のコールバック
 */
export default function ApplyForm({
  onComplete,
}: {
  onComplete: () => void;
}): JSX.Element {
  const [form, setForm] = useState<MerchantApplyForm>(INITIAL);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** 入力値を更新するヘルパー。 */
  function set<K extends keyof MerchantApplyForm>(
    key: K,
    value: MerchantApplyForm[K],
  ): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** 送信処理。検証→API呼び出し→完了切替。 */
  async function handleSubmit(): Promise<void> {
    setSubmitError(null);
    const result = merchantApplyFormSchema.safeParse(form);
    if (!result.success) {
      const next: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof MerchantApplyForm | undefined;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const data = result.data;
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "qolc_merchant",
          applicant_name: `${data.contactLastName} ${data.contactFirstName}`.trim(),
          applicant_org: data.facilityName,
          applicant_email: data.contactEmail,
          applicant_phone: data.contactPhone,
          message: data.note ?? "",
          payload: data,
        }),
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
        {/* 事業者区分 */}
        <div className="apply-form-section" style={{ marginTop: 0 }}>
          事業者区分
        </div>
        <div className="apply-form-group">
          <div className="apply-form-label">
            事業者区分 <span className="apply-form-required">必須</span>
          </div>
          <div className="apply-form-radio-group">
            {(["法人", "個人事業主"] as const).map((v) => (
              <label
                key={v}
                className={`apply-form-radio${form.corpType === v ? " selected" : ""}`}
              >
                <div className="apply-form-radio-dot" />
                <input
                  type="radio"
                  name="corpType"
                  checked={form.corpType === v}
                  onChange={() => set("corpType", v)}
                />{" "}
                {v}
              </label>
            ))}
          </div>
        </div>

        {/* 法人情報 */}
        <div className="apply-form-section">法人情報</div>
        <Field
          label="法人名"
          required
          hint="全角50文字以内。登記上の正式名称をご入力ください"
          error={errors.corpName}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="例：株式会社サンプルケア"
            maxLength={50}
            value={form.corpName}
            onChange={(e) => set("corpName", e.target.value)}
          />
        </Field>
        <Field
          label="法人名フリガナ"
          required
          hint="全角カタカナ。カード会社への申請書類に使用します"
          error={errors.corpNameKana}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="例：カブシキガイシャサンプルケア"
            maxLength={50}
            value={form.corpNameKana}
            onChange={(e) => set("corpNameKana", e.target.value)}
          />
        </Field>
        {form.corpType === "法人" && (
          <Field
            label="法人番号（13桁）"
            required
            hint="半角数字13桁。国税庁法人番号公表サイトで確認できます。カード会社への申請に必要です"
            error={errors.corporateNumber}
          >
            <input
              className="apply-form-input"
              type="text"
              placeholder="1234567890123"
              maxLength={13}
              inputMode="numeric"
              style={{ maxWidth: 200 }}
              value={form.corporateNumber}
              onChange={(e) => set("corporateNumber", e.target.value)}
            />
          </Field>
        )}
        <Field
          label="郵便番号"
          required
          hint="半角数字7桁（ハイフンあり・なしどちらでも可）"
          error={errors.postalCode}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="123-4567"
            maxLength={8}
            inputMode="numeric"
            style={{ maxWidth: 160 }}
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
          />
        </Field>
        <Field
          label="所在地"
          required
          hint="全角60文字以内。都道府県名から番地・建物名までご入力ください"
          error={errors.address}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="東京都千代田区丸の内1-1-1"
            maxLength={60}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>
        <Field
          label="電話番号"
          required
          hint="半角数字+ハイフン、13文字以内（例：03-1234-5678）"
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

        {/* 代表者情報 */}
        <div className="apply-form-section">代表者情報</div>
        <Field
          label="代表者氏名"
          required
          hint="全角。姓名合わせて49文字以内"
          error={errors.repLastName ?? errors.repFirstName}
        >
          <div className="apply-form-row">
            <input
              className="apply-form-input"
              type="text"
              placeholder="姓"
              maxLength={24}
              value={form.repLastName}
              onChange={(e) => set("repLastName", e.target.value)}
            />
            <input
              className="apply-form-input"
              type="text"
              placeholder="名"
              maxLength={24}
              value={form.repFirstName}
              onChange={(e) => set("repFirstName", e.target.value)}
            />
          </div>
        </Field>
        <Field
          label="代表者氏名フリガナ"
          required
          hint="全角カタカナ"
          error={errors.repLastNameKana ?? errors.repFirstNameKana}
        >
          <div className="apply-form-row">
            <input
              className="apply-form-input"
              type="text"
              placeholder="セイ"
              maxLength={24}
              value={form.repLastNameKana}
              onChange={(e) => set("repLastNameKana", e.target.value)}
            />
            <input
              className="apply-form-input"
              type="text"
              placeholder="メイ"
              maxLength={24}
              value={form.repFirstNameKana}
              onChange={(e) => set("repFirstNameKana", e.target.value)}
            />
          </div>
        </Field>
        <Field
          label="代表者 生年月日"
          required
          hint="18歳以上であること。未来の日付は不可"
          error={errors.repBirthdate}
        >
          <input
            className="apply-form-input"
            type="date"
            style={{ maxWidth: 200 }}
            value={form.repBirthdate}
            onChange={(e) => set("repBirthdate", e.target.value)}
          />
        </Field>

        {/* 施設情報 */}
        <div className="apply-form-section">施設情報</div>
        <Field
          label="施設名"
          required
          hint="全角20文字以内。カード明細に表示される名称となります"
          error={errors.facilityName}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="例：サンプルケア有料老人ホーム東京"
            maxLength={20}
            value={form.facilityName}
            onChange={(e) => set("facilityName", e.target.value)}
          />
        </Field>
        <Field
          label="施設名フリガナ"
          required
          hint="全角カタカナ。カード明細のカナ表記に使用します"
          error={errors.facilityNameKana}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="例：サンプルケアユウリョウロウジンホームトウキョウ"
            maxLength={30}
            value={form.facilityNameKana}
            onChange={(e) => set("facilityNameKana", e.target.value)}
          />
        </Field>
        <Field
          label="施設 郵便番号"
          required
          hint="半角数字7桁"
          error={errors.facilityPostalCode}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="123-4567"
            maxLength={8}
            inputMode="numeric"
            style={{ maxWidth: 160 }}
            value={form.facilityPostalCode}
            onChange={(e) => set("facilityPostalCode", e.target.value)}
          />
        </Field>
        <Field
          label="施設 所在地"
          required
          hint="全角60文字以内。都道府県名から番地・建物名まで"
          error={errors.facilityAddress}
        >
          <input
            className="apply-form-input"
            type="text"
            placeholder="東京都千代田区丸の内1-1-1"
            maxLength={60}
            value={form.facilityAddress}
            onChange={(e) => set("facilityAddress", e.target.value)}
          />
        </Field>
        <Field
          label="施設 電話番号"
          required
          hint="半角数字+ハイフン、13文字以内"
          error={errors.facilityPhone}
        >
          <input
            className="apply-form-input"
            type="tel"
            placeholder="03-1234-5678"
            maxLength={13}
            style={{ maxWidth: 220 }}
            value={form.facilityPhone}
            onChange={(e) => set("facilityPhone", e.target.value)}
          />
        </Field>

        {/* ご担当者情報 */}
        <div className="apply-form-section">ご担当者情報</div>
        <Field
          label="ご担当者名"
          required
          hint="全角。ヒアリングのご連絡先となる方のお名前"
          error={errors.contactLastName ?? errors.contactFirstName}
        >
          <div className="apply-form-row">
            <input
              className="apply-form-input"
              type="text"
              placeholder="姓"
              maxLength={10}
              value={form.contactLastName}
              onChange={(e) => set("contactLastName", e.target.value)}
            />
            <input
              className="apply-form-input"
              type="text"
              placeholder="名"
              maxLength={10}
              value={form.contactFirstName}
              onChange={(e) => set("contactFirstName", e.target.value)}
            />
          </div>
        </Field>
        <Field
          label="メールアドレス"
          required
          hint="半角英数字。審査状況のお知らせ・ヒアリングのご連絡に使用します"
          error={errors.contactEmail}
        >
          <input
            className="apply-form-input"
            type="email"
            placeholder="sample@example.com"
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
          />
        </Field>
        <Field
          label="ご連絡先電話番号"
          required
          hint="半角数字+ハイフン。ヒアリング時のお電話先となります"
          error={errors.contactPhone}
        >
          <input
            className="apply-form-input"
            type="tel"
            placeholder="090-1234-5678"
            maxLength={13}
            style={{ maxWidth: 220 }}
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
          />
        </Field>
        <Field
          label="ご連絡希望時間帯"
          hint="担当スタッフからお電話を差し上げる際の希望時間帯"
        >
          <div className="apply-form-radio-group">
            {CONTACT_TIMES.map((v) => (
              <label
                key={v}
                className={`apply-form-radio${form.contactTime === v ? " selected" : ""}`}
              >
                <div className="apply-form-radio-dot" />
                <input
                  type="radio"
                  name="contactTime"
                  checked={form.contactTime === v}
                  onChange={() => set("contactTime", v)}
                />{" "}
                {v}
              </label>
            ))}
          </div>
        </Field>
        <Field label="備考・ご質問" hint="500文字以内。任意" error={errors.note}>
          <textarea
            className="apply-form-input"
            rows={3}
            maxLength={500}
            placeholder="施設の入居者数、利用予定のサービス、ご質問など"
            value={form.note ?? ""}
            onChange={(e) => set("note", e.target.value)}
          />
        </Field>
      </div>

      {/* カード会社審査に関する注意書き */}
      <div className="apply-caution">
        <div className="apply-caution-title">
          <span aria-hidden>&#9888;</span> カード会社審査に関するご注意
        </div>
        <p>
          加盟店審査はJCB・セゾン各社が行います。審査基準は各社の判断によるため、結果をお約束するものではございません。ヒアリング時に、カナ表記や業種分類など、審査に必要な追加情報をお伺いすることがあります。正確な情報をご提供いただくことで審査がスムーズに進みます。
        </p>
      </div>

      {submitError && <p className="apply-submit-error">{submitError}</p>}

      <div className="apply-actions">
        <button
          type="button"
          className="btn-green"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "送信中..." : "この内容で申請する →"}
        </button>
      </div>
    </>
  );
}

/**
 * 1項目分のラベル＋ヒント＋エラー表示を伴うフィールドラッパー。
 */
function Field({
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
        {label}{" "}
        {required && <span className="apply-form-required">必須</span>}
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
