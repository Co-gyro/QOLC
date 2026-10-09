"use client";

/** 編集中の宛先 */
export interface ContactDraft {
  kind: "to" | "cc";
  name: string;
  email: string;
}

/**
 * 宛先（To/CC・氏名つき）を複数登録する入力欄。請求メール・カード登録案内メールの送付先になる。
 */
export function ContactsEditor({ value, onChange }: { value: ContactDraft[]; onChange: (v: ContactDraft[]) => void }) {
  const field = "min-h-[44px] rounded border border-[#E0DDD8] px-2";
  const set = (i: number, patch: Partial<ContactDraft>) =>
    onChange(value.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className="space-y-2">
      {value.map((c, i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <select aria-label={`宛先${i + 1}の種別`} className={field} value={c.kind} onChange={(e) => set(i, { kind: e.target.value as "to" | "cc" })}>
            <option value="to">To</option>
            <option value="cc">CC</option>
          </select>
          <input aria-label={`宛先${i + 1}の氏名`} className={`${field} w-36`} placeholder="氏名（任意）" value={c.name} onChange={(e) => set(i, { name: e.target.value })} />
          <input aria-label={`宛先${i + 1}のメール`} type="email" className={`${field} min-w-[240px] flex-1`} placeholder="info@example.com" value={c.email} onChange={(e) => set(i, { email: e.target.value })} />
          <button type="button" className={`${field} px-3`} aria-label={`宛先${i + 1}を削除`} disabled={value.length <= 1} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="min-h-[44px] rounded border border-[#E0DDD8] bg-white px-3 font-bold" onClick={() => onChange([...value, { kind: "cc", name: "", email: "" }])}>
        ＋ 宛先を追加
      </button>
    </div>
  );
}
