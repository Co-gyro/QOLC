/**
 * 審査結果フォーム（カード会社1社分）
 *
 * 提出日・結果・結果受領日・NG理由・加盟店番号（JCBは登録型+都度型ECの2種）を
 * 入力し、POST /api/admin/applications/[id]/review で保存する。
 */
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { saveApplicationReview } from "@/lib/applications/client";
import {
  REVIEW_COMPANY_LABELS,
  type CompanyReview,
  type ReviewCompany,
} from "@/lib/applications/ud-input";

export interface ReviewCompanyFormProps {
  applicationId: string;
  company: ReviewCompany;
  current: CompanyReview | undefined;
  onSaved: () => void;
}

const INPUT_CLASS = "border rounded px-2 py-2 text-sm w-full bg-white";
const INPUT_STYLE = { borderColor: "var(--qolc-border)", minHeight: 44 };

export function ReviewCompanyForm({
  applicationId,
  company,
  current,
  onSaved,
}: ReviewCompanyFormProps) {
  const [submittedAt, setSubmittedAt] = useState(current?.submitted_at ?? "");
  const [result, setResult] = useState<string>(current?.result ?? "");
  const [receivedAt, setReceivedAt] = useState(current?.result_received_at ?? "");
  const [ngReason, setNgReason] = useState(current?.ng_reason ?? "");
  const [codeRecurring, setCodeRecurring] = useState(current?.merchant_code_recurring ?? "");
  const [codeEc, setCodeEc] = useState(current?.merchant_code_ec ?? "");
  const [code, setCode] = useState(current?.merchant_code ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 1社分の審査結果を保存する */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await saveApplicationReview(applicationId, {
        company,
        submitted_at: submittedAt || null,
        result: result === "approved" || result === "rejected" ? result : null,
        result_received_at: receivedAt || null,
        ng_reason: ngReason || null,
        merchant_code_recurring: company === "jcb" ? codeRecurring || null : null,
        merchant_code_ec: company === "jcb" ? codeEc || null : null,
        merchant_code: company === "saison" ? code || null : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  const label = REVIEW_COMPANY_LABELS[company];
  return (
    <form
      className="flex flex-col gap-3 rounded border p-3"
      style={{ borderColor: "var(--qolc-border)" }}
      onSubmit={handleSubmit}
    >
      <p className="text-sm font-bold" style={{ color: "var(--qolc-text)" }}>
        {label}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>提出日</span>
          <input type="date" className={INPUT_CLASS} style={INPUT_STYLE} value={submittedAt}
            onChange={(e) => setSubmittedAt(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>審査結果</span>
          <select className={INPUT_CLASS} style={INPUT_STYLE} value={result}
            onChange={(e) => setResult(e.target.value)}>
            <option value="">結果待ち</option>
            <option value="approved">通過</option>
            <option value="rejected">NG</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span style={{ color: "var(--qolc-muted)" }}>結果受領日</span>
          <input type="date" className={INPUT_CLASS} style={INPUT_STYLE} value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)} />
        </label>
        {result === "rejected" && (
          <label className="flex flex-col gap-1 text-sm">
            <span style={{ color: "var(--qolc-muted)" }}>NG理由</span>
            <input type="text" className={INPUT_CLASS} style={INPUT_STYLE} value={ngReason}
              maxLength={500} placeholder="例：業態確認のため追加資料が必要"
              onChange={(e) => setNgReason(e.target.value)} />
          </label>
        )}
      </div>
      {company === "jcb" ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs" style={{ color: "var(--qolc-muted)" }}>
            施設ごとに2種類のJCB加盟店番号が必要です（登録型=会員ID決済・継続課金用／都度型EC=カード登録時のトークン決済用）。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: "var(--qolc-muted)" }}>加盟店番号（登録型）</span>
              <input type="text" className={INPUT_CLASS} style={INPUT_STYLE} value={codeRecurring}
                maxLength={17} placeholder="半角数字（最大17桁）"
                onChange={(e) => setCodeRecurring(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span style={{ color: "var(--qolc-muted)" }}>加盟店番号（都度型EC）</span>
              <input type="text" className={INPUT_CLASS} style={INPUT_STYLE} value={codeEc}
                maxLength={17} placeholder="半角数字（最大17桁）"
                onChange={(e) => setCodeEc(e.target.value)} />
            </label>
          </div>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm sm:w-1/2">
          <span style={{ color: "var(--qolc-muted)" }}>加盟店番号（加盟店No.）</span>
          <input type="text" className={INPUT_CLASS} style={INPUT_STYLE} value={code}
            maxLength={7} placeholder="通常7桁" onChange={(e) => setCode(e.target.value)} />
        </label>
      )}
      {error && (
        <p className="text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}
          style={{ backgroundColor: "var(--qolc-primary)", color: "white", minHeight: 44 }}>
          {saving ? "保存中…" : `${label}の審査結果を保存`}
        </Button>
      </div>
    </form>
  );
}
