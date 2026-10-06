"use client";

import { formatYen } from "@/lib/udpay/logic";

/** 編集中の明細行（key はクライアント管理用の連番） */
export interface EditableLine {
  key: number;
  description: string;
  quantity: number;
  unitPrice: number;
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
        <input
          aria-label="数量"
          type="number"
          min={1}
          value={line.quantity}
          onChange={(e) => onChange({ quantity: Number(e.target.value) })}
        />
      </td>
      <td>
        <input
          aria-label="単価"
          type="number"
          value={line.unitPrice}
          onChange={(e) => onChange({ unitPrice: Number(e.target.value) })}
        />
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
