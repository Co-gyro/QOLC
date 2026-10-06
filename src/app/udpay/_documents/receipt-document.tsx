/* eslint-disable @next/next/no-img-element -- 印刷用帳票のため next/image の遅延読込を避ける */
import type { ReceiptRow, TaxBreakdown } from "@/lib/udpay/documents";
import type { MerchantProfile } from "@/lib/udpay/merchant-profile";

/** 領収証の明細欄の行数（フォーマットどおり10行） */
const MIN_ROWS = 10;

/** 金額を「90,909 円」表記にする */
function yen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")} 円`;
}

/** 領収証に載せる内容 */
export interface ReceiptDocumentData {
  customerName: string;
  postalCode?: string;
  address1?: string;
  address2?: string;
  number: string;
  /** 発行日・領収日（YYYY年M月D日） */
  issueDate: string;
  paidDate: string;
  subject: string;
  rows: ReceiptRow[];
  breakdown: TaxBreakdown;
  /** 備考欄の1行目（お支払方法） */
  paymentNote: string;
}

/**
 * 領収証（ランサイド様指定フォーマット準拠・A4）。
 * 明細は税抜・消費税・税込に分け、合計は請求書と一致させる（端数は documents.receiptRows で調整）。
 */
export function ReceiptDocument({ data, merchant }: { data: ReceiptDocumentData; merchant: MerchantProfile }) {
  const sum = (key: "net" | "tax" | "gross") => data.rows.reduce((s, r) => s + r[key], 0);
  const blanks = Math.max(MIN_ROWS - data.rows.length, 0);
  return (
    <div className="up-doc up-rcp">
      <h1 className="title">領<span>収</span>書</h1>
      <table style={{ marginTop: 18 }}>
        <tbody>
          <tr>
            <td style={{ width: "54%", verticalAlign: "top", padding: 0 }}>
              <div className="to">{data.customerName}　御中</div>
              <div style={{ padding: "12px 0 0 36px", minHeight: 76 }}>
                {data.postalCode && <div>〒{data.postalCode}</div>}
                {data.address1 && <div>{data.address1}</div>}
                {data.address2 && <div>{data.address2}</div>}
              </div>
              <div style={{ paddingLeft: 36, marginTop: 12 }}>下記、正に領収いたしました。</div>
              <table className="box" style={{ marginLeft: 30, width: "88%" }}>
                <tbody>
                  <tr><td className="lbl" style={{ width: 64 }}>件名</td><td>{data.subject}</td></tr>
                </tbody>
              </table>
              <table className="box" style={{ marginLeft: 30, width: "88%", marginTop: 20 }}>
                <tbody>
                  <tr><td className="lbl">合計金額（税込）</td></tr>
                  <tr><td className="big">{yen(sum("gross"))}</td></tr>
                </tbody>
              </table>
            </td>
            <td style={{ verticalAlign: "top", paddingLeft: 16 }}>
              <table className="issuer">
                <tbody>
                  <tr><td style={{ width: 80 }}>発行日</td><td>：</td><td><strong>{data.issueDate}</strong></td></tr>
                  <tr><td>請求№</td><td>：</td><td><strong>{data.number}</strong></td></tr>
                  <tr><td>領収日</td><td>：</td><td><strong>{data.paidDate}</strong></td></tr>
                </tbody>
              </table>
              <img className="logo" src={merchant.logoPath} alt={merchant.name} style={{ margin: "10px 0 4px auto" }} />
              <table className="issuer">
                <tbody>
                  <tr><td style={{ width: 72 }} /><td>{merchant.name}</td></tr>
                  <tr><td>住所</td><td>〒{merchant.postalCode}</td></tr>
                  <tr><td /><td><strong>{merchant.receiptAddress1}</strong></td></tr>
                  <tr><td /><td>{merchant.address2}</td></tr>
                  <tr><td>電話</td><td><strong>{merchant.tel}</strong></td></tr>
                  <tr><td>担当</td><td><strong>{merchant.contact}</strong></td></tr>
                  <tr><td>登録番号</td><td>{merchant.registrationNumber}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <table className="lines" style={{ marginTop: 18 }}>
        <thead>
          <tr>
            <th style={{ width: 34 }}>No</th><th style={{ textAlign: "left" }}>摘要</th>
            <th style={{ width: 46, fontSize: 14, lineHeight: 1.15 }}>軽減<br />税率</th><th style={{ width: 120 }}>金額（税抜）</th>
            <th style={{ width: 100 }}>消費税額</th><th style={{ width: 120 }}>金額（税込）</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
            <tr key={i}>
              <td className="r">{i + 1}</td><td>{r.description}</td><td className="c">{r.reduced ? "*" : ""}</td>
              <td className="r">{yen(r.net)}</td><td className="r">{yen(r.tax)}</td><td className="r">{yen(r.gross)}</td>
            </tr>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <tr key={`blank-${i}`}>
              <td className="r">{data.rows.length + i + 1}</td><td /><td /><td /><td /><td />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3}>合計</td>
            <td className="r">{yen(sum("net"))}</td><td className="r">{yen(sum("tax"))}</td><td className="r">{yen(sum("gross"))}</td>
          </tr>
        </tfoot>
      </table>
      <table style={{ width: "50%", margin: "8px 0 0 38%" }}>
        <tbody>
          <tr><td style={{ padding: "0 0 2px" }}>※「*」は軽減税率対象です。</td></tr>
          <tr>
            <td style={{ padding: 0 }}>
              <table className="kubun">
                <thead><tr><th>税区分</th><th>金額（税抜）</th><th>消費税額</th></tr></thead>
                <tbody>
                  <tr><td className="c">10%対象</td><td className="r">{yen(data.breakdown.r10.base)}</td><td className="r">{yen(data.breakdown.r10.tax)}</td></tr>
                  <tr><td className="c">8%対象</td><td className="r">{yen(data.breakdown.r8.base)}</td><td className="r">{yen(data.breakdown.r8.tax)}</td></tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ margin: "14px 0 4px 16px" }}><span style={{ color: "var(--c)" }}>■</span> 備考</div>
      <div className="note-line" style={{ paddingTop: 2 }}>{data.paymentNote}</div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="note-line" />
      ))}
    </div>
  );
}
