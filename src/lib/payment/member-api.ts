/**
 * USEN PSP 会員ID決済API クライアント（定常決済）
 *
 * 認証: HMAC-MD5
 * エンドポイント例（本番）: https://inet-uketsuke1.netmove.jp/payment/...
 *
 * QOLC の核心機能。登録済みカード（usen_member_id）に対して与信→売上計上を行う。
 */
import { callUsenApi, joinUrl, isUsenSuccess } from "./usen-client";
import { logPaymentAudit } from "./audit-log";
import { UsenApiError } from "./errors";
import type {
  AuthByMemberIdRequest,
  AuthByMemberIdResponse,
  SalesActionRequest,
  SalesActionResponse,
  AuthVoidRequest,
  AuthVoidResponse,
  SearchTradeRequest,
  SearchTradeResponse,
  MemberEntryRequest,
  MemberEntryResponse,
  MemberGetRequest,
  MemberGetResponse,
  AuditAction,
} from "./types";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const ALGORITHM = "md5" as const;

/** 会員ID API のベースURL を環境変数から取得 */
function baseUrl(): string {
  const url = process.env.USEN_API_BASE_URL;
  if (!url) {
    throw new UsenApiError("USEN_API_BASE_URL が設定されていません");
  }
  return url;
}

/** Member API の必須環境変数 */
function siteAndMall(overrideMall?: string): { site_cd: string; mall_cd: string } {
  const site_cd = process.env.USEN_SITE_CD;
  if (!site_cd) throw new UsenApiError("USEN_SITE_CD が設定されていません");
  const mall_cd = overrideMall ?? process.env.USEN_MALL_CD;
  if (!mall_cd) throw new UsenApiError("mall_cd が解決できません");
  return { site_cd, mall_cd };
}

/** 監査ログを記録しつつAPIを呼ぶ共通関数 */
async function callAndLog<TReq extends object, TResp extends { res_cd?: string }>(
  path: string,
  action: AuditAction,
  request: TReq,
  options: {
    paymentId?: string | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<TResp> {
  const url = joinUrl(baseUrl(), path);
  const params = request as unknown as Record<
    string,
    string | number | undefined | null
  >;

  let resp: TResp;
  let errorThrown: unknown = null;
  try {
    resp = await callUsenApi<TResp>({
      url,
      params,
      algorithm: ALGORITHM,
      fetchImpl: options.fetchImpl,
    });
  } catch (e) {
    errorThrown = e;
    resp = {} as TResp;
  }

  // 監査ログ記録（失敗時もログを残す）
  await logPaymentAudit({
    paymentId: options.paymentId ?? null,
    action,
    request,
    response: errorThrown
      ? { error: errorThrown instanceof Error ? errorThrown.message : String(errorThrown) }
      : resp,
    performedBy: options.performedBy ?? null,
    ipAddress: options.ipAddress ?? null,
  });

  if (errorThrown) throw errorThrown;
  return resp;
}

// ============================================================
// 採番
// ============================================================

/**
 * mall_cd ごとの jutyu_cd を採番する（DB関数 next_jutyu_cd を呼び出し）。
 * 形式: [mall_cd]-[7桁連番] 例: A300-0000001
 */
export async function nextJutyuCd(mallCd: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("next_jutyu_cd", {
    p_mall_cd: mallCd,
  });
  if (error) {
    throw new UsenApiError(`jutyu_cd 採番失敗: ${error.message}`);
  }
  if (typeof data !== "string") {
    throw new UsenApiError("jutyu_cd 採番結果が文字列ではありません");
  }
  return data;
}

// ============================================================
// 会員管理
// ============================================================

/** /member/entrybyjutyucd: 取引経由で会員登録（カード登録フローの最後） */
export async function memberEntryByJutyuCd(
  args: { member_id: string; jutyu_cd: string; mall_cd?: string },
  ctx: { paymentId?: string | null; performedBy?: string | null; ipAddress?: string | null; fetchImpl?: typeof fetch } = {}
): Promise<MemberEntryResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: MemberEntryRequest = {
    site_cd,
    mall_cd,
    jutyu_cd: args.jutyu_cd,
    member_id: args.member_id,
  };
  return callAndLog<MemberEntryRequest, MemberEntryResponse>(
    "/member/entrybyjutyucd",
    "member_entry",
    req,
    ctx
  );
}

/** /member/get: 会員情報取得（カード下4桁、ブランド、有効期限） */
export async function memberGet(
  args: { member_id: string; mall_cd?: string },
  ctx: { performedBy?: string | null; fetchImpl?: typeof fetch } = {}
): Promise<MemberGetResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: MemberGetRequest = { site_cd, mall_cd, member_id: args.member_id };
  return callAndLog<MemberGetRequest, MemberGetResponse>(
    "/member/get",
    "member_get",
    req,
    ctx
  );
}

/** /member/inactivate: 会員を一時無効化 */
export async function memberInactivate(
  args: { member_id: string; mall_cd?: string },
  ctx: { performedBy?: string | null; fetchImpl?: typeof fetch } = {}
) {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  return callAndLog(
    "/member/inactivate",
    "member_inactivate",
    { site_cd, mall_cd, member_id: args.member_id },
    ctx
  );
}

/** /member/activate: 会員を再有効化 */
export async function memberActivate(
  args: { member_id: string; mall_cd?: string },
  ctx: { performedBy?: string | null; fetchImpl?: typeof fetch } = {}
) {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  return callAndLog(
    "/member/activate",
    "member_activate",
    { site_cd, mall_cd, member_id: args.member_id },
    ctx
  );
}

/** /member/delete: 会員削除 */
export async function memberDelete(
  args: { member_id: string; mall_cd?: string },
  ctx: { performedBy?: string | null; fetchImpl?: typeof fetch } = {}
) {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  return callAndLog(
    "/member/delete",
    "member_delete",
    { site_cd, mall_cd, member_id: args.member_id },
    ctx
  );
}

// ============================================================
// 与信・売上
// ============================================================

/**
 * /member/authbymemberid: 会員IDで与信取得（★QOLCのメイン決済API）
 */
export async function authByMemberId(
  args: { member_id: string; amount: number; jutyu_cd: string; mall_cd?: string },
  ctx: {
    paymentId?: string | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<AuthByMemberIdResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: AuthByMemberIdRequest = {
    site_cd,
    mall_cd,
    member_id: args.member_id,
    jutyu_cd: args.jutyu_cd,
    amount: args.amount,
  };
  const resp = await callAndLog<AuthByMemberIdRequest, AuthByMemberIdResponse>(
    "/member/authbymemberid",
    "auth_by_member_id",
    req,
    ctx
  );
  if (!isUsenSuccess(resp)) {
    throw new UsenApiError(
      `与信失敗: ${resp.err_msg ?? resp.res_cd ?? "unknown"}`,
      { errorCode: resp.err_cd ?? resp.res_cd, responseBody: resp }
    );
  }
  return resp;
}

/** /sales/salesadd: 売上計上 */
export async function salesAdd(
  args: { jutyu_cd: string; amount?: number; mall_cd?: string },
  ctx: {
    paymentId?: string | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<SalesActionResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: SalesActionRequest = {
    site_cd,
    mall_cd,
    jutyu_cd: args.jutyu_cd,
    amount: args.amount,
  };
  return callAndLog<SalesActionRequest, SalesActionResponse>(
    "/sales/salesadd",
    "sales_add",
    req,
    ctx
  );
}

/** /sales/salescancel: 売上取消 */
export async function salesCancel(
  args: { jutyu_cd: string; mall_cd?: string },
  ctx: { paymentId?: string | null; performedBy?: string | null; fetchImpl?: typeof fetch } = {}
): Promise<SalesActionResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  return callAndLog<SalesActionRequest, SalesActionResponse>(
    "/sales/salescancel",
    "sales_cancel",
    { site_cd, mall_cd, jutyu_cd: args.jutyu_cd },
    ctx
  );
}

/** /sales/salesreturn: 返金 */
export async function salesReturn(
  args: { jutyu_cd: string; amount?: number; mall_cd?: string },
  ctx: { paymentId?: string | null; performedBy?: string | null; fetchImpl?: typeof fetch } = {}
): Promise<SalesActionResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  return callAndLog<SalesActionRequest, SalesActionResponse>(
    "/sales/salesreturn",
    "sales_return",
    { site_cd, mall_cd, jutyu_cd: args.jutyu_cd, amount: args.amount },
    ctx
  );
}

/** /auth/void: 与信取消 */
export async function authVoid(
  args: { jutyu_cd: string; mall_cd?: string },
  ctx: {
    paymentId?: string | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<AuthVoidResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: AuthVoidRequest = { site_cd, mall_cd, jutyu_cd: args.jutyu_cd };
  return callAndLog<AuthVoidRequest, AuthVoidResponse>(
    "/auth/void",
    "auth_void",
    req,
    ctx
  );
}

/** /auth/change: 与信金額変更 */
export async function authChange(
  args: { jutyu_cd: string; amount: number; mall_cd?: string },
  ctx: { paymentId?: string | null; performedBy?: string | null; fetchImpl?: typeof fetch } = {}
): Promise<SalesActionResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  return callAndLog<SalesActionRequest, SalesActionResponse>(
    "/auth/change",
    "auth_change",
    { site_cd, mall_cd, jutyu_cd: args.jutyu_cd, amount: args.amount },
    ctx
  );
}

/** /search/trade: 取引照会 */
export async function searchTrade(
  args: { jutyu_cd: string; mall_cd?: string },
  ctx: { fetchImpl?: typeof fetch } = {}
): Promise<SearchTradeResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: SearchTradeRequest = { site_cd, mall_cd, jutyu_cd: args.jutyu_cd };
  return callAndLog<SearchTradeRequest, SearchTradeResponse>(
    "/search/trade",
    "search_trade",
    req,
    ctx
  );
}
