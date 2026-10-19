"use client";

import { useEffect, useState } from "react";
import { formatYen, parseIntegerInput } from "@/lib/udpay/logic";

/** 編集中の明細行（key はクライアント管理用の連番） */
export interface EditableLine {
  key: number;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * 数字の入力欄。入力中の文字はそのまま保持し、整数として読めたときだけ値を更新する
 * （type="number" だと「-」を打った瞬間に空になり、マイナス金額を直接入力できなかった。2026-10 ランサイド様指摘）。
 */
function IntegerInput({ label, value, onValue, min }: { label: string; value: number; onValue: (v: number) => void; min?: number }) {
  const [text, setText] = useState(String(value));
  // 外から値が変わったとき（行の追加など）は表示を合わせる
  useEffect(() => {
    if (parseIntegerInput(text) !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      aria-label={label}
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseIntegerInput(e.target.value);
        if (v !== null && (min === undefined || v >= min)) onValue(v);
      }}
      // 入力欄に入ったら全体を選択する（新しい行の「0」の前に打ち込まれないように）
      onFocus={(e) => e.target.select()}
      onBlur={() => setText(String(value))}
    />
  );
}

/** 請求明細エディタの1行（摘要・数量・単価。単価のマイナスは値引き） */
export function LineRow({
  line,
  onChange,
  onRemove,
}: {
  line: EditableLine;
  onChange: (patch: Partial<EditableLine>) => void;
  onRemove: () => void;
}) {
  return (
    <tr>
      <td>
        <input
          aria-label="摘要"
          value={line.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </td>
      <td>
        <IntegerInput label="数量" value={line.quantity} min={1} onValue={(quantity) => onChange({ quantity })} />
      </td>
      <td>
        <IntegerInput label="単価" value={line.unitPrice} onValue={(unitPrice) => onChange({ unitPrice })} />
      </td>
      <td className="num" style={{ color: line.unitPrice < 0 ? "var(--red)" : undefined }}>
        {formatYen(line.unitPrice * line.quantity)}
      </td>
      <td>
        <button
          type="button"
          className="up-btn secondary small"
          aria-label="行を削除"
          onClick={onRemove}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
