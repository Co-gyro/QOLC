import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * 加盟店カルテの「利用者」: 加盟店に属するログインアカウントを役割をまたいで一覧し、
 * パスワード設定メールの送信（初回の招待し直し・パスワードの再設定）と利用停止／再開を行う。
 * 対象の役割: サービス提供者（profiles.role=provider・profiles.merchant_id）と
 * UD Payment 利用者（udpay_members.merchant_id）。
 */

/** アカウントの種類 */
export type AccountKind = "provider" | "udpay";

/** アカウントの状態 */
export type AccountStatus = "invited" | "active" | "suspended";

/** 加盟店のアカウント1件 */
export interface MerchantAccount {
  userId: string;
  kind: AccountKind;
  displayName: string;
  email: string | null;
  /** 権限の表示（例: 承認者・担当者・提供者） */
  roleLabel: string;
  status: AccountStatus;
  lastSignInAt: string | null;
  createdAt: string | null;
}

/** auth ユーザーの状態（停止中／利用中／招待中＝一度もログインしていない） */
export function accountStatusOf(user: Pick<User, "last_sign_in_at"> & { banned_until?: string | null }, now: Date): AccountStatus {
  if (user.banned_until && new Date(user.banned_until).getTime() > now.getTime()) return "suspended";
  return user.last_sign_in_at ? "active" : "invited";
}

/** 加盟店のアカウント一覧（提供者＋UD Payment 利用者） */
export async function listMerchantAccounts(client: SupabaseClient, merchantId: string, now: Date = new Date()): Promise<MerchantAccount[]> {
  const [{ data: providers }, { data: members }] = await Promise.all([
    client.from("profiles").select("id, display_name").eq("merchant_id", merchantId).eq("role", "provider").is("deleted_at", null),
    client.from("udpay_members").select("user_id, display_name, is_approver").eq("merchant_id", merchantId).is("deleted_at", null),
  ]);
  const base = [
    ...((providers ?? []) as { id: string; display_name: string | null }[]).map((p) => ({ userId: p.id, kind: "provider" as const, displayName: p.display_name ?? "", roleLabel: "サービス提供者" })),
    ...((members ?? []) as { user_id: string; display_name: string; is_approver: boolean }[]).map((m) => ({
      userId: m.user_id,
      kind: "udpay" as const,
      displayName: m.display_name,
      roleLabel: m.is_approver ? "UD Payment 承認者" : "UD Payment 担当者",
    })),
  ];
  const result: MerchantAccount[] = [];
  for (const a of base) {
    const { data } = await client.auth.admin.getUserById(a.userId);
    const u = data?.user as (User & { banned_until?: string | null }) | undefined;
    result.push({
      ...a,
      email: u?.email ?? null,
      status: u ? accountStatusOf(u, now) : "invited",
      lastSignInAt: u?.last_sign_in_at ?? null,
      createdAt: u?.created_at ?? null,
    });
  }
  return result;
}

/** アカウントがこの加盟店に属しているか（他社のアカウントは操作させない） */
export async function findMerchantAccount(client: SupabaseClient, merchantId: string, userId: string): Promise<MerchantAccount | null> {
  return (await listMerchantAccounts(client, merchantId)).find((a) => a.userId === userId) ?? null;
}

/** パスワード設定メールの文面（UD Payment 利用者は UD Payment 名義、提供者は QOLC 名義） */
export function buildPasswordSetupMail(input: { kind: AccountKind; displayName: string; link: string; firstTime: boolean }) {
  const service = input.kind === "udpay" ? "UD Payment" : "QOLC";
  const lead = input.firstTime
    ? `${service}のログインアカウントのご案内を、あらためてお送りします。`
    : `${service}のパスワード再設定のご依頼を承りました。`;
  return {
    subject: `【${service}】パスワード設定のご案内`,
    text: `${input.displayName} 様

${lead}
下記のリンクを開き、パスワードを設定してください。設定が終わると、そのまま画面をお使いいただけます。

▼パスワード設定
${input.link}

・このリンクの有効期限は24時間です。期限が切れた場合はご連絡ください。
・2回目以降のログイン: https://app.qolc.jp/login
・お心当たりのない場合は、このメールを破棄してください（パスワードは変わりません）。

ご不明な点は support@uni-dev.jp までお問い合わせください。

株式会社ユニバーサル・デベロップメント`,
  };
}

/**
 * パスワード設定用のリンクを作る（初回の招待し直し・再設定の両方に使う）。
 * 招待リンクの期限切れでメール未確認のままのアカウントは、先に確認済みにしてから再設定リンクを作る。
 */
export async function createPasswordSetupLink(
  client: SupabaseClient,
  userId: string,
  appUrl: string,
): Promise<{ ok: true; email: string; link: string } | { ok: false; error: string }> {
  const { data } = await client.auth.admin.getUserById(userId);
  const user = data?.user;
  if (!user?.email) return { ok: false, error: "アカウントが見つかりません" };
  if (!user.email_confirmed_at) {
    const { error } = await client.auth.admin.updateUserById(userId, { email_confirm: true });
    if (error) return { ok: false, error: `アカウントの更新に失敗しました: ${error.message}` };
  }
  const { data: link, error } = await client.auth.admin.generateLink({
    type: "recovery",
    email: user.email,
    options: { redirectTo: `${appUrl.replace(/\/$/, "")}/set-password` },
  });
  const url = link?.properties?.action_link;
  if (error || !url) return { ok: false, error: "パスワード設定リンクの作成に失敗しました" };
  return { ok: true, email: user.email, link: url };
}

/** 利用停止（ログイン不可）・再開 */
export async function setAccountSuspended(client: SupabaseClient, userId: string, suspended: boolean): Promise<{ ok: boolean; error?: string }> {
  const { error } = await client.auth.admin.updateUserById(userId, { ban_duration: suspended ? "876000h" : "none" });
  return error ? { ok: false, error: error.message } : { ok: true };
}
