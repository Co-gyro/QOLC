/**
 * 申請者情報の表示（詳細ドロワーの先頭セクション）
 */
import type { ApplicationDetail } from "@/lib/applications/types";

/** ラベル + 値の1行表示（値が空なら "—"） */
function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs" style={{ color: "var(--qolc-muted)" }}>
        {label}
      </dt>
      <dd className="whitespace-pre-wrap break-words" style={{ color: "var(--qolc-text)" }}>
        {value?.trim() || "—"}
      </dd>
    </div>
  );
}

export function ApplicantInfo({ detail }: { detail: ApplicationDetail }) {
  return (
    <dl className="grid grid-cols-1 gap-1 text-sm">
      <Field label="お名前" value={detail.applicantName} />
      <Field label="所属" value={detail.applicantOrg} />
      <Field label="メール" value={detail.applicantEmail} />
      <Field label="電話" value={detail.applicantPhone} />
      <Field label="ご連絡内容" value={detail.message} />
    </dl>
  );
}
