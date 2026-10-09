/* eslint-disable @next/next/no-img-element -- 印刷用帳票のため next/image の遅延読込を避ける */
import { formatDateJa } from "@/lib/udpay/logic";
import { taxBreakdown } from "@/lib/udpay/documents";
import type { MerchantProfile } from "@/lib/udpay/merchant-profile";
import type { UdpayInvoiceLine } from "@/lib/udpay/types";
import { CustomerName } from "./customer-name";

/** 請求書の明細欄の最低行数（フォーマットの行数に合わせて空行で埋める） */
const MIN_ROWS = 13;

/** 金額を「9,900」表記にする（帳票は円記号なし） */
function n(amount: number): string {
  return amount.toLocaleString("ja-JP");
}

/** 請求書に載せる内容 */
export interface InvoiceDocumentData {
  customerName: string;
  number: string;
  /** 請求日（YYYY/M/D） */
  issueDate: string;
  subject: string;
  /** 決済日（YYYY-MM-DD） */
  chargeDate: string;
  /** 支払方法の表示（例: クレジットカード（Visa 下4桁 4242）） */
  paymentMethod: string;
  lines: UdpayInvoiceLine[];
  subtotal: number;
  tax: number;
  total: number;
}

/**
 * 請求書（ランサイド様指定フォーマット準拠・A4）。
 * 元フォーマットの「支払期限・振込先」は、カード自動決済に合わせて「決済日・お支払方法」に置き換え、
 * 備考の振込手数料の注記は自動決済の案内に置き換えている。
 */
export function InvoiceDocument({ data, merchant }: { data: InvoiceDocumentData; merchant: MerchantProfile }) {
  const b = taxBreakdown(data.lines);
  const blanks = Math.max(MIN_ROWS - data.lines.length, 0);
  return (
    <div className="up-doc up-inv">
      <h1 className="title">請求書</h1>
      <table>
        <tbody>
          <tr>
            <td className="to" style={{ width: "58%", paddingRight: 28 }}>
              <CustomerName name={data.customerName} />
            </td>
            <td>
              <table>
                <tbody>
                  <tr><td style={{ width: 70 }}>請求日</td><td>{data.issueDate}</td></tr>
                  <tr><td>請求№</td><td>{data.number}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ margin: "16px 0 4px" }}>下記のとおり、御請求申し上げます。</p>
      <table>
        <tbody>
          <tr>
            <td style={{ width: "58%", padding: 0, verticalAlign: "top" }}>
              <table>
                <tbody>
                  <tr><td className="lbl">件名</td><td>{data.subject}</td></tr>
                  <tr><td className="lbl">決済日</td><td>{formatDateJa(data.chargeDate)}</td></tr>
                  <tr><td className="lbl" rowSpan={2}>お支払<br />方法</td><td>{data.paymentMethod}</td></tr>
                  <tr><td>による自動決済（お振込は不要です）</td></tr>
                </tbody>
              </table>
              <table className="total-box" style={{ marginTop: 18, width: "84%" }}>
                <tbody>
                  <tr><td className="lbl">合計</td><td className="c">{n(data.total)} 円 (税込)</td></tr>
                </tbody>
              </table>
            </td>
            <td style={{ verticalAlign: "top", paddingLeft: 24 }}>
              <img className="logo" src={merchant.logoPath} alt={merchant.name} />
              <div>{merchant.name}</div>
              <div style={{ paddingLeft: 14 }}>
                <div>〒{merchant.postalCode}</div>
                <div>{merchant.address1}</div>
                <div>{merchant.address2}</div>
                <div>TEL：{merchant.tel}</div>
                <div>担当：{merchant.contact}</div>
                <div>登録番号：{merchant.registrationNumber}</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <table className="lines" style={{ marginTop: 22 }}>
        <thead>
          <tr>
            <th>摘要</th><th style={{ width: 70 }}>数量</th><th style={{ width: 50 }}>単位</th>
            <th style={{ width: 95 }}>単価</th><th style={{ width: 50 }}>税率</th><th style={{ width: 100 }}>金額</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l) => (
            <tr key={l.id}>
              <td>{l.taxRate === 8 ? "※" : ""}{l.description}</td>
              <td className="r">{l.quantity}</td>
              <td className="c">式</td>
              <td className="r">{n(l.unitPrice)}</td>
              <td className="r">{l.taxRate}%</td>
              <td className="r">{n(l.unitPrice * l.quantity)}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <tr key={`blank-${i}`}><td /><td /><td /><td /><td /><td /></tr>
          ))}
        </tbody>
      </table>
      <table style={{ marginTop: 2 }}>
        <tbody>
          <tr>
            <td style={{ width: "42%", verticalAlign: "top", padding: 0 }}>
              <div style={{ fontSize: 14 }}>※は軽減税率対象</div>
              <table className="breakdown">
                <tbody>
                  <tr className="head"><th>税率別内訳</th><th className="r">税抜金額</th><th className="r">消費税額</th></tr>
                  <tr><td className="r">10%対象</td><td className="r">{n(b.r10.base)}</td><td className="r">{n(b.r10.tax)}</td></tr>
                  <tr><td className="r">軽減8%対象</td><td className="r">{n(b.r8.base)}</td><td className="r">{n(b.r8.tax)}</td></tr>
                  <tr><td className="r">0%対象</td><td className="r">{n(b.r0.base)}</td><td className="r">{n(b.r0.tax)}</td></tr>
                </tbody>
              </table>
            </td>
            <td style={{ width: "26%" }} />
            <td style={{ verticalAlign: "top", padding: 0 }}>
              <table className="sums">
                <tbody>
                  <tr><td className="lbl">小計</td><td className="r">{n(data.subtotal)}</td></tr>
                  <tr><td className="lbl">消費税</td><td className="r">{n(data.tax)}</td></tr>
                  <tr><td className="lbl">合計</td><td className="r">{n(data.total)}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <div className="note-bar">備考</div>
      <div style={{ padding: "4px 2px" }}>
        ※ご登録のクレジットカードにて{formatDateJa(data.chargeDate)}に自動決済いたします。お振込の必要はございません。
      </div>
    </div>
  );
}
