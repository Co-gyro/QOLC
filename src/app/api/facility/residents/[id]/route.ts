/**
 * GET /api/facility/residents/[id]
 *
 * 入居者の詳細（家族/本人アカウント一覧・招待状況）を返す。
 * facility_staff は他ユーザーの profiles/email を RLS で読めないため、
 * service_role + 施設所属検証で安全に返す。
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/types/api";
import type { UserRole } from "@/types";

/** facility_staff/admin の権限と施設所属を検証し、入居者を返す */
async function authorizeResident(req: NextRequest, residentId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: apiError("認証されていません", "UNAUTHORIZED"), status: 401 as const };

  const role =
    (user.app_metadata?.role as UserRole | undefined) ??
    ((await supabase.from("profiles").select("role").eq("id", user.id).single()).data?.role as
      | UserRole
      | undefined);
  if (role !== "facility_staff" && role !== "admin") {
    return { error: apiError("権限がありません", "FORBIDDEN"), status: 403 as const };
  }

  const admin = getSupabaseAdminClient();
  const { data: resident } = await admin
    .from("residents")
    .select("id, facility_id, name_last, name_first, insurance_number")
    .eq("id", residentId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!resident) {
    return { error: apiError("入居者が見つかりません", "NOT_FOUND"), status: 404 as const };
  }

  if (role === "facility_staff") {
    const { data: prof } = await admin
      .from("profiles")
      .select("facility_id")
      .eq("id", user.id)
      .single();
    if (prof?.facility_id !== resident.facility_id) {
      return { error: apiError("権限がありません", "FORBIDDEN"), status: 403 as const };
    }
  }
  return { admin, resident, userId: user.id };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorizeResident(req, params.id);
  if ("error" in auth) {
    return NextResponse.json(auth.error, { status: auth.status });
  }
  const { admin, resident } = auth;

  // アカウント一覧
  const { data: accounts } = await admin
    .from("resident_accounts")
    .select("id, user_id, type, is_payment_owner, usen_member_id, created_at")
    .eq("resident_id", resident.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const accountDetails = await Promise.all(
    (accounts ?? []).map(async (a) => {
      let displayName: string | null = null;
      let email: string | null = null;
      // profile 表示名
      const { data: prof } = await admin
        .from("profiles")
        .select("display_name")
        .eq("id", a.user_id)
        .maybeSingle();
      displayName = (prof?.display_name as string | null) ?? null;
      // auth のメール
      try {
        const { data: u } = await admin.auth.admin.getUserById(a.user_id as string);
        email = u.user?.email ?? null;
      } catch {
        /* ignore */
      }
      return {
        id: a.id,
        type: a.type,
        isPaymentOwner: a.is_payment_owner,
        cardRegistered: !!a.usen_member_id,
        displayName,
        email,
      };
    })
  );

  // 招待一覧
  const { data: invitations } = await admin
    .from("invitations")
    .select("id, account_type, is_payment_owner, email, expires_at, used_at, created_at")
    .eq("resident_id", resident.id)
    .order("created_at", { ascending: false });

  const now = Date.now();
  const inviteDetails = (invitations ?? []).map((i) => ({
    id: i.id,
    accountType: i.account_type,
    isPaymentOwner: i.is_payment_owner,
    email: i.email,
    status: i.used_at
      ? "used"
      : new Date(i.expires_at).getTime() < now
        ? "expired"
        : "pending",
    expiresAt: i.expires_at,
    createdAt: i.created_at,
  }));

  return NextResponse.json(
    apiOk({
      resident: {
        nameLast: resident.name_last,
        nameFirst: resident.name_first,
        insuranceNumber: resident.insurance_number,
      },
      accounts: accountDetails,
      invitations: inviteDetails,
    })
  );
}
