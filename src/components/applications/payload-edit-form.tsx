"use client";

/**
 * 申請内容（payload）の編集フォーム（加盟店申請・admin用）
 *
 * 電話受付などの手動起票案件はフォーム入力内容が空のため、この画面で補完する。
 * 入力済み項目のみ形式検証し、段階的な入力を許容する（完全性は申請書生成時に担保）。
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { merchantApplyFormBaseSchema } from "@/lib/applications/schema";
import { UD_INPUT_CLASS, UD_INPUT_STYLE } from "./ud-text-field";

export interface PayloadEditFormProps {
  payload: Record<string, unknown> | null;
  saving: boolean;
  onSave: (payload: Record<string, unknown>) => void;
  onCancel: () => void;
}

/** 編集対象フィールドの定義（公開フォームと同じ項目・並び） */
const FIELDS: Array<{
  key: string;
  label: string;
  type?: "date" | "select" | "textarea";
  options?: readonly string[];
  hint?: string;
}> = [
  { key: "corpType", label: "事業者区分", type: "select", options: ["法人", "個人事業主"] },
  { key: "corpName", label: "法人名・屋号" },
  { key: "corpNameKana", label: "法人名フリガナ（全角カナ）" },
  { key: "corporateNumber", label: "法人番号（13桁）", hint: "法人の場合は必須" },
  { key: "postalCode", label: "郵便番号" },
  { key: "address", label: "所在地" },
  { key: "phone", label: "電話番号", hint: "例: 03-1234-5678" },
  { key: "repLastName", label: "代表者 姓" },
  { key: "repFirstName", label: "代表者 名" },
  { key: "repLastNameKana", label: "代表者 姓フリガナ" },
  { key: "repFirstNameKana", label: "代表者 名フリガナ" },
  { key: "repBirthdate", label: "代表者 生年月日", type: "date" },
  { key: "facilityName", label: "施設名" },
  { key: "facilityNameKana", label: "施設名フリガナ" },
  { key: "facilityPostalCode", label: "施設 郵便番号" },
  { key: "facilityAddress", label: "施設 所在地" },
  { key: "facilityPhone", label: "施設 電話番号" },
  { key: "contactLastName", label: "ご担当者 姓" },
  { key: "contactFirstName", label: "ご担当者 名" },
  { key: "contactEmail", label: "ご担当者 メール" },
  { key: "contactPhone", label: "ご担当者 電話番号" },
  { key: "contactTime", label: "連絡希望時間帯", type: "select", options: ["いつでも", "午前中", "午後"] },
  { key: "note", label: "備考", type: "textarea" },
];

export function PayloadEditForm({ payload, saving, onSave, onCancel }: PayloadEditFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) {
      const v = payload?.[f.key];
      init[f.key] = typeof v === "string" ? v : "";
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // 空欄は保存対象から外し、入力済みの項目だけ形式検証する
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, v]) => v.trim() !== "")
    );
    const check = merchantApplyFormBaseSchema.partial().safeParse(filled);
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "入力内容を確認してください");
      return;
    }
    onSave(filled);
  }

  const set = (key: string) => (v: string) => setValues((p) => ({ ...p, [key]: v }));

  return (
    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        お客様フォームと同じ項目です。分かっている項目から入力して保存できます
        （形式チェックは入力済み項目のみ。全項目の完全性は申請書作成時に検証されます）。
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>{f.label}</span>
            {f.type === "select" ? (
              <select
                className={UD_INPUT_CLASS}
                style={UD_INPUT_STYLE}
                value={values[f.key]}
                onChange={(e) => set(f.key)(e.target.value)}
              >
                <option value="">未選択</option>
                {f.options?.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                className={UD_INPUT_CLASS}
                style={{ ...UD_INPUT_STYLE, minHeight: 72 }}
                value={values[f.key]}
                maxLength={500}
                onChange={(e) => set(f.key)(e.target.value)}
              />
            ) : (
              <input
                type={f.type === "date" ? "date" : "text"}
                className={UD_INPUT_CLASS}
                style={UD_INPUT_STYLE}
                value={values[f.key]}
                maxLength={254}
                onChange={(e) => set(f.key)(e.target.value)}
              />
            )}
            {f.hint && (
              <span className="text-xs" style={{ color: "var(--qolc-muted)" }}>
                {f.hint}
              </span>
            )}
          </label>
        ))}
      </div>
      {error && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} style={{ minHeight: 44 }}>
          キャンセル
        </Button>
        <Button
          type="submit"
          disabled={saving}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}
        >
          {saving ? "保存中…" : "申請内容を保存"}
        </Button>
      </div>
    </form>
  );
}
