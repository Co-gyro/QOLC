import Link from "next/link";

/** 絞り込みの選択肢 */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * 絞り込みバー（キーワード検索＋状態などの選択）。
 * GET フォームで送るため、条件は URL に残る（戻る・共有で同じ一覧が開ける）。
 */
export function FilterBar({
  basePath,
  q,
  selectName,
  selectLabel,
  selectValue,
  options,
  hidden = {},
  placeholder,
}: {
  basePath: string;
  q?: string;
  selectName: string;
  selectLabel: string;
  selectValue?: string;
  options: FilterOption[];
  hidden?: Record<string, string | undefined>;
  placeholder: string;
}) {
  const clearParams = new URLSearchParams();
  for (const [k, v] of Object.entries(hidden)) if (v) clearParams.set(k, v);
  return (
    <form className="up-filter" action={basePath} method="get" role="search">
      {Object.entries(hidden).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <div className="up-field">
        <label htmlFor="up-filter-q" className="up-sr">キーワード</label>
        <input id="up-filter-q" name="q" defaultValue={q} placeholder={`🔍 ${placeholder}`} />
      </div>
      <div className="up-field">
        <label htmlFor="up-filter-select" className="up-sr">{selectLabel}</label>
        <select id="up-filter-select" name={selectName} defaultValue={selectValue ?? ""}>
          <option value="">{selectLabel}: すべて</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="up-btn small">
        絞り込む
      </button>
      {(q || selectValue) && (
        <Link className="up-btn secondary small" href={`${basePath}?${clearParams.toString()}`}>
          条件をクリア
        </Link>
      )}
    </form>
  );
}
