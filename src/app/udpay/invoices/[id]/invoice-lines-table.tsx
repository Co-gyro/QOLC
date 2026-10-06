import { formatYen } from "@/lib/udpay/logic";
import type { UdpayInvoiceLine } from "@/lib/udpay/types";

/** 請求明細の表示用テーブル（課金予約・決済確定後の読み取り専用表示） */
export function InvoiceLinesTable({
  lines,
  total,
}: {
  lines: UdpayInvoiceLine[];
  total: number;
}) {
  return (
    <div className="up-table-wrap">
      <table className="up-table">
        <thead>
          <tr>
            <th>摘要</th>
            <th className="num">数量</th>
            <th className="num">単価（税抜）</th>
            <th className="num">金額</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td>{l.description}</td>
              <td className="num">{l.quantity}</td>
              <td className="num">{formatYen(l.unitPrice)}</td>
              <td className="num">{formatYen(l.unitPrice * l.quantity)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="num" style={{ fontWeight: 700 }}>
              合計（税込）
            </td>
            <td className="num" style={{ fontWeight: 800 }}>
              {formatYen(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
