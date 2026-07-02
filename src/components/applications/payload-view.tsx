/**
 * 申請フォーム全項目（payload jsonb）の整形表示
 */

/** payload の値を文字列へ整形 */
function stringify(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "はい" : "いいえ";
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

/** キー名の簡易日本語化（未知キーはそのまま表示） */
const KEY_LABELS: Record<string, string> = {
  company_name: "会社名",
  facility_name: "施設名",
  contact_name: "ご担当者名",
  email: "メールアドレス",
  phone: "電話番号",
  message: "ご相談内容",
  address: "住所",
  business_type: "業態",
  desired_area: "希望エリア",
  budget: "ご予算",
};

export function PayloadView({ payload }: { payload: Record<string, unknown> | null }) {
  const entries = payload ? Object.entries(payload) : [];
  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--qolc-muted)" }}>
        フォーム項目はありません。
      </p>
    );
  }
  return (
    <dl className="grid grid-cols-1 gap-2">
      {entries.map(([k, v]) => (
        <div key={k} className="flex flex-col">
          <dt className="text-xs" style={{ color: "var(--qolc-muted)" }}>
            {KEY_LABELS[k] ?? k}
          </dt>
          <dd
            className="text-sm whitespace-pre-wrap break-words"
            style={{ color: "var(--qolc-text)" }}
          >
            {stringify(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
