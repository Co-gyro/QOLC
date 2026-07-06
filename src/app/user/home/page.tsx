import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalWelcome, PORTAL_FEATURES } from "@/components/layout/portal-welcome";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** ISO(yyyy-mm-...) から「2026年6月」表記を作る（TZ非依存） */
function toMonthLabel(iso: string | null): string {
  if (!iso) return "";
  const [y, m] = iso.slice(0, 7).split("-");
  return `${y}年${Number(m)}月`;
}

/** ISO から「2026/07/06」表記を作る（TZ非依存） */
function toDateLabel(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10).replaceAll("-", "/");
}

/**
 * ユーザーポータル ホーム。
 * 直近の決済（RLS family read）とカード登録状況（resident_accounts）を実データで表示する。
 */
export default async function UserHomePage() {
  const supabase = createSupabaseServerClient();

  const [{ data: latest }, { data: account }] = await Promise.all([
    supabase
      .from("payments")
      .select("id, total_amount, captured_at")
      .in("payment_status", ["captured", "refunded"])
      .order("captured_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("resident_accounts")
      .select("id, usen_member_id")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const cardRegistered = !!account?.usen_member_id;

  return (
    <PortalLayout portal="user">
      <PortalWelcome portal="user" features={PORTAL_FEATURES.user} />

      <Card className="mb-6" style={{ borderColor: "var(--qolc-accent)", borderWidth: 2 }}>
        <CardHeader>
          <CardTitle className="text-xl">お知らせ{latest ? "（1件）" : ""}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base">
            {latest
              ? `${toMonthLabel(latest.captured_at as string | null)}のお支払いが完了しました。領収書ページからご確認いただけます。`
              : "現在お知らせはありません。"}
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-xl">直近のお支払い</CardTitle>
        </CardHeader>
        <CardContent>
          {latest ? (
            <>
              <p className="text-4xl font-bold" style={{ color: "var(--qolc-primary)" }}>
                ¥{((latest.total_amount as number) ?? 0).toLocaleString("ja-JP")}
              </p>
              <p className="text-sm mt-2" style={{ color: "var(--qolc-muted)" }}>
                ※ 決済日: {toDateLabel(latest.captured_at as string | null)}
              </p>
            </>
          ) : (
            <p className="text-base" style={{ color: "var(--qolc-muted)" }}>
              まだお支払いはありません。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">カード登録状況</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base mb-3">
            {cardRegistered ? (
              <span className="font-bold">カード登録済み</span>
            ) : (
              <span className="font-bold" style={{ color: "var(--qolc-accent)" }}>
                カードが未登録です
              </span>
            )}
          </p>
          <a
            href="/user/card"
            className="qolc-btn inline-block px-6 py-3 rounded text-white text-lg font-medium"
            style={{ backgroundColor: "var(--qolc-primary)", minHeight: 48 }}
          >
            カード管理画面へ
          </a>
        </CardContent>
      </Card>
    </PortalLayout>
  );
}
