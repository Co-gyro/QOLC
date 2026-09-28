import type { Metadata } from "next";
import { createMerchantApiDeps } from "@/lib/merchant-api/runtime";
import { isSessionId } from "@/lib/merchant-api/ids";
import { CheckoutError, openCheckout, type CheckoutView } from "@/lib/merchant-api/service-checkout";
import { CheckoutSummary } from "./checkout-summary";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "お支払い",
  robots: { index: false, follow: false },
};

/** 決済できない状態のときの案内文 */
const CLOSED_MESSAGE: Record<string, string> = {
  succeeded: "お支払いは完了しています。",
  failed: "お支払いを完了できませんでした。",
  cancelled: "お支払いは中断されました。",
  expired: "お支払いの有効期限が切れました。お手数ですが、購入手続きを最初からやり直してください。",
  refunded: "このお支払いは返金済みです。",
  pending: "お支払いの結果を確認しています。しばらくしてから画面を再読み込みしてください。",
};

/**
 * 当社ホストの決済画面（加盟店の redirect_url の遷移先）。
 * カード番号・セキュリティコードは USEN の iframe に入力され、当社サーバを通らない。
 */
export default async function CheckoutPage({ params }: { params: { sessionId: string } }) {
  let view: CheckoutView | null = null;
  let error: string | null = null;
  if (!isSessionId(params.sessionId)) {
    error = "お支払い画面が見つかりません。購入手続きを最初からやり直してください。";
  } else {
    try {
      view = await openCheckout(createMerchantApiDeps(), params.sessionId);
    } catch (e) {
      error = e instanceof CheckoutError ? e.message : "ただいまお支払い画面を表示できません。しばらくしてからお試しください。";
      if (!(e instanceof CheckoutError)) {
        // eslint-disable-next-line no-console
        console.error("[checkout] open error", e);
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] px-4 py-8 text-[#333333]">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <header className="text-center">
          <p className="text-base font-bold tracking-wide">UD Payment</p>
          <h1 className="mt-1 text-xl font-bold">お支払い</h1>
        </header>

        {view?.environment === "test" && (
          <p className="rounded border border-[#E8913A] bg-[#FFF6EC] p-3 text-sm">
            テスト環境です。実際のご請求は発生しません。
          </p>
        )}

        {error && <p className="rounded bg-[#FEE2E2] p-4 text-base text-[#991B1B]">{error}</p>}

        {view && <CheckoutSummary view={view} />}

        {view && view.usen && (
          <CheckoutForm
            sessionId={view.sessionId}
            jutyuCd={view.usen.jutyuCd}
            mallCd={view.usen.mallCd}
            tokenJsUrl={view.usen.tokenJsUrl}
            sdkApiBaseUrl={view.usen.sdkApiBaseUrl}
          />
        )}

        {view && !view.usen && (
          <section className="space-y-4 rounded-lg border border-[#E0DDD8] bg-white p-5">
            <p className="text-base">{CLOSED_MESSAGE[view.status] ?? CLOSED_MESSAGE.pending}</p>
            {view.returnUrl && (
              <a
                href={view.returnUrl}
                className="flex min-h-[48px] items-center justify-center rounded bg-[#333333] px-4 text-base font-bold text-white"
              >
                ショップへ戻る
              </a>
            )}
          </section>
        )}

        <footer className="pt-2 text-center text-sm text-[#666666]">
          決済代行：株式会社ユニバーサル・デベロップメント
        </footer>
      </div>
    </main>
  );
}
