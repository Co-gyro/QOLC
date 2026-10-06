import { loadStore } from "@/lib/udpay/store";
import { CardForm } from "./card-form";

export const dynamic = "force-dynamic";

/**
 * 顧客向けカード登録ページ（公開・登録リンクから到達）。
 * ランサイド様の顧客（歯科医院）がメールで受け取ったリンクを開き、自身でカードを登録する。
 */
export default async function UdpayCardRegisterPage({
  params,
}: {
  params: { token: string };
}) {
  const store = await loadStore();
  const customer = store.customers.find(
    (c) => c.registrationToken === params.token,
  );

  return (
    <main className="up-container" style={{ maxWidth: 560 }}>
      <div style={{ textAlign: "center", margin: "24px 0" }}>
        <span className="up-brand-name" style={{ color: "var(--navy)", fontSize: 22 }}>
          UD <span style={{ color: "var(--blue)" }}>Payment</span>
        </span>
        <div style={{ color: "var(--muted)" }}>お支払いカードのご登録</div>
      </div>

      {!customer ? (
        <div className="up-card">
          <p className="up-error">
            この登録リンクは無効です。お手数ですが、株式会社ランサイドの担当者へ
            ご連絡をお願いいたします。
          </p>
        </div>
      ) : (
        <>
          <div className="up-notice">
            <strong>{customer.name} {customer.contactName}先生</strong>
            <br />
            株式会社ランサイドのサービス利用料のお支払いに使用するクレジットカードをご登録ください。
          </div>
          <div className="up-card" style={{ marginBottom: 12 }}>
            <strong>ご登録の前にご確認ください</strong>
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>
                ご登録のカードで、<strong>株式会社ランサイドからのご請求を毎月お支払い</strong>いただきます
                （毎月{customer.anniversaryDay}日ごろに自動でお支払い。お振込は不要です）。
              </li>
              <li>ご請求の内容は、お支払い前にメールでお知らせします。</li>
              <li>カード番号は決済代行会社で安全に管理され、ランサイド・UDでは保持しません。</li>
            </ul>
          </div>
          {customer.card.registered && (
            <p className="up-notice">
              現在 {customer.card.brand} {customer.card.maskedNumber} が登録されています。
              新しいカードを登録すると差し替えられ、次回のお支払いから新しいカードを使います。
            </p>
          )}
          <CardForm token={params.token} />
        </>
      )}
    </main>
  );
}
