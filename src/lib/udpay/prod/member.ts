import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/** /billing を使うログインユーザー（加盟店の担当者・承認者） */
export interface BillingMember {
  userId: string;
  merchantId: string;
  displayName: string;
  /** 一括実行（決済確定）ができるか */
  isApprover: boolean;
}

/**
 * ログイン中ユーザーの UD Payment 利用者情報（udpay_members）。利用者でなければ null。
 * ロールの判定は middleware（udpay_merchant のみ /billing に入れる）が先に行う。
 */
export async function getBillingMember(): Promise<BillingMember | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await getSupabaseAdminClient()
    .from("udpay_members")
    .select("user_id, merchant_id, display_name, is_approver")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return {
    userId: data.user_id as string,
    merchantId: data.merchant_id as string,
    displayName: data.display_name as string,
    isApprover: Boolean(data.is_approver),
  };
}
