import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardRegisterButton } from "@/components/shared/card-register-button";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface ResidentAccountRow {
  id: string;
  is_payment_owner: boolean;
  usen_member_id: string | null;
}

/** カード登録結果のバナー文言 */
function statusBanner(status?: string, reason?: string) {
  if (status === "registered") {
    return { kind: "success" as const, text: "カードの登録が完了しました。" };
  }
  if (status === "failed") {
    const detail: Record<string, string> = {
      invalid_check_cd: "検証エラー（署名不一致）",
      registration_failed: "カード会員登録に失敗しました",
      missing_params: "必要な情報が不足しています",
      save_failed: "登録情報の保存に失敗しました",
    };
    return {
      kind: "error" as const,
      text: `カード登録に失敗しました${reason ? `（${detail[reason] ?? reason}）` : ""}。`,
    };
  }
  return null;
}

export default async function UserCardPage({
  searchParams,
}: {
  searchParams: { status?: string; reason?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ログイン中ユーザーの resident_account（RLSで自己参照のみ許可）
  let account: ResidentAccountRow | null = null;
  if (user) {
    const { data } = await supabase
      .from("resident_accounts")
      .select("id, is_payment_owner, usen_member_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    account = (data as ResidentAccountRow | null) ?? null;
  }

  const banner = statusBanner(searchParams.status, searchParams.reason);
  const registered = !!account?.usen_member_id;
  const isOwner = !!account?.is_payment_owner;

  return (
    <PortalLayout portal="user">
      <h1 className="text-3xl font-bold mb-6">カード管理</h1>

      {banner && (
        <div
          className="mb-6 p-4 rounded-lg text-base"
          style={
            banner.kind === "success"
              ? { backgroundColor: "#E6F4EA", color: "#1B5E20" }
              : { backgroundColor: "#FEE2E2", color: "#991B1B" }
          }
        >
          {banner.text}
        </div>
      )}

      {!account ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">入居者アカウントが見つかりません</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base" style={{ color: "var(--qolc-muted)" }}>
              施設からの招待が必要です。ご不明な場合は施設担当者へお問い合わせください。
            </p>
          </CardContent>
        </Card>
      ) : registered ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">登録済みカード</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: "var(--qolc-bg-soft)" }}>
              <p className="text-2xl font-bold">カード登録済み</p>
              <p className="text-base mt-1" style={{ color: "var(--qolc-muted)" }}>
                会員ID: {maskMemberId(account.usen_member_id!)}
              </p>
            </div>
            {isOwner ? (
              <CardRegisterButton residentAccountId={account.id} label="カードを変更する" />
            ) : (
              <p className="text-sm p-3 rounded" style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-muted)" }}>
                カードの変更は支払い担当者のみ可能です。
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card style={{ borderColor: "var(--qolc-accent)", borderWidth: 2 }}>
          <CardHeader>
            <CardTitle className="text-xl">カードが未登録です</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-base mb-4">ご利用にはクレジットカードの登録が必要です。</p>
            {isOwner ? (
              <CardRegisterButton residentAccountId={account.id} large />
            ) : (
              <p className="text-sm p-3 rounded" style={{ backgroundColor: "var(--qolc-bg-soft)", color: "var(--qolc-muted)" }}>
                カードの登録は支払い担当者のみ可能です。
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </PortalLayout>
  );
}

/** 会員IDを下4桁のみ表示 */
function maskMemberId(id: string): string {
  if (id.length <= 4) return "****";
  return "****" + id.slice(-4);
}
