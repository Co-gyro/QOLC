import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { nextJutyuCd } from "@/lib/payment/member-api";
import { formatExpireYm } from "@/lib/payment/card-expiry";
import { loadRegistrationContext } from "@/lib/udpay/prod/card-registration";
import { CardRegistrationForm } from "./card-registration-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "お支払いカードのご登録",
  robots: { index: false, follow: false },
};

/**
 * UD Payment のカード登録ページ（顧客向け・ログイン不要）。
 * 加盟店（例: 株式会社ランサイド）から届いた登録リンクを開き、顧客自身がカードを登録する。
 * カード番号・セキュリティコードは USEN の入力欄（iframe）に入力され、当社サーバーには届かない。
 */
export default async function UdpayCardRegistrationPage({ params }: { params: { token: string } }) {
  const loaded = await loadRegistrationContext(getSupabaseAdminClient(), params.token);
  if (!loaded.ok) {
    return (
      <Shell title="お支払いカードのご登録">
        <p className="rounded bg-[#FEE2E2] p-4 text-base text-[#991B1B]">
          {loaded.error === "invalid_link"
            ? "この登録リンクは無効です。お手数ですが、ご請求元の担当者へお問い合わせください。"
            : "ただいまカード登録を受け付けられません。お手数ですが、ご請求元の担当者へお問い合わせください。"}
        </p>
      </Shell>
    );
  }
  const { customer, merchant } = loaded.ctx;
  const jutyuCd = await nextJutyuCd(merchant.mallCode);
  const tokenJsUrl = process.env.NEXT_PUBLIC_USEN_TOKEN_JS_URL ?? "";
  const sdkApiBaseUrl = process.env.NEXT_PUBLIC_USEN_TOKEN_EC_API_BASE_URL || null;
  const day = customer.chargeDay ? `毎月${customer.chargeDay}日` : "毎月の決済日";

  return (
    <Shell title={`${merchant.name} お支払いカードのご登録`}>
      <p className="text-base">
        <strong>{customer.name}</strong>
        {customer.contactName ? ` ${customer.contactName}様` : " 御中"}
      </p>
      <div className="rounded-lg border border-[#E0DDD8] bg-white p-4 text-base leading-relaxed">
        <p className="font-bold">ご登録の前にご確認ください</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            ご登録のカードで、<strong>{merchant.name}からのご請求を{day}にお支払い</strong>いただきます（お振込は不要です）。
          </li>
          <li>ご請求の内容は、お支払いの前にメールでお知らせします。</li>
          <li>ご登録の確認のため1円の確認（与信）を行いますが、実際には請求されません。</li>
          <li>カード番号は決済代行会社で安全に管理され、{merchant.name}・当社では保持しません。</li>
        </ul>
      </div>
      {customer.usenMemberId && (
        <p className="rounded bg-[#F0F9F4] p-3 text-base">
          現在 {customer.cardBrand ?? "カード"}
          {customer.cardLast4 ? `（下4桁 ${customer.cardLast4}・有効期限 ${formatExpireYm(customer.cardExpireYm)}）` : ""}
          が登録されています。新しいカードを登録すると差し替えられ、次回のお支払いから新しいカードを使います。
        </p>
      )}
      <CardRegistrationForm
        token={params.token}
        jutyuCd={jutyuCd}
        mallCd={merchant.mallCode}
        tokenJsUrl={tokenJsUrl}
        sdkApiBaseUrl={sdkApiBaseUrl}
        merchantName={merchant.name}
      />
      <p className="text-center text-sm text-[#666]" style={{ fontSize: 14 }}>
        決済システム提供：株式会社ユニバーサル・デベロップメント
      </p>
    </Shell>
  );
}

/** ページの外枠（スマホ幅で読みやすい1カラム） */
function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F6F7F5] px-4 py-8 text-[#333333]">
      <div className="mx-auto max-w-[560px] space-y-4">
        <h1 className="text-xl font-bold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
