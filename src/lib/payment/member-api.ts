/**
 * USEN PSP 会員ID決済API クライアント（IF仕様書 1.1.0 準拠）
 *
 * - 認証: チェックコード = "HM" + HMAC-MD5(指定フィールドを "," 連結, HMACキー)
 * - キー切替:
 *   - USEN_GROUP_ID 設定時（推奨）: 全API共通でサイト鍵で署名し、リクエストに
 *     group_id を隠しパラメータとして付与する（USEN推奨方式、配下複数モールに対応）。
 *   - 未設定時（後方互換）: 会員登録系=サイト鍵 / 与信・売上・取消系=モール鍵。
 * - レスポンス: XML（<response><result>ok|ng</result>...）
 * - jutyu_cd の上位4桁がモールコード（mall_cd 単独パラメータは無い）
 */
import { postForm, parseXmlResponse, joinUrl, isOk } from "./usen-client";
import { generateCheckCode, type UsenKeyType } from "./hmac";
import { logPaymentAudit } from "./audit-log";
import { UsenApiError } from "./errors";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  MemberApiResult,
  AuthByMemberIdParams,
  SalesAddParams,
  SalesCancelParams,
  AuthVoidParams,
  MemberEntryParams,
  MemberGetParams,
  SearchTradeParams,
  AuditAction,
} from "./types";

const ALGO = "md5" as const;

/** 会員ID決済APIのベースURL */
function memberBaseUrl(): string {
  const url = process.env.USEN_MEMBER_API_BASE_URL;
  if (!url) throw new UsenApiError("USEN_MEMBER_API_BASE_URL が設定されていません");
  return url;
}

/** サイトコードを環境変数から取得 */
function siteCd(): string {
  const v = process.env.USEN_SITE_CD;
  if (!v) throw new UsenApiError("USEN_SITE_CD が設定されていません");
  return v;
}

/**
 * group_id を環境変数から取得（未設定なら undefined）。
 * 設定時は全APIに隠しパラメータとして付与し、サイト鍵で署名する。
 */
function groupId(): string | undefined {
  const v = process.env.USEN_GROUP_ID;
  return v && v.length > 0 ? v : undefined;
}

/**
 * 実行時に使うHMACキー種別を決定する。
 * group_id 設定時はサイト鍵に統一、未設定時は引数 fallback を使う。
 */
function resolveKeyType(fallback: UsenKeyType): UsenKeyType {
  return groupId() ? "site" : fallback;
}

/** Date を yyyy/mm/dd 形式に整形（USEN仕様の日付形式） */
export function formatUsenDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

interface CallContext {
  paymentId?: string | null;
  performedBy?: string | null;
  ipAddress?: string | null;
  fetchImpl?: typeof fetch;
}

/**
 * 会員ID決済APIを呼び出す共通処理。
 * check_cd を生成して付与し、XMLをパースし、監査ログを記録する。
 *
 * @param opts.keyType - フォールバック鍵種別（group_id 未設定時に使用）。
 *   group_id 設定時はサイト鍵に強制統一される。
 */
async function callMemberApi(opts: {
  path: string;
  keyType: UsenKeyType;
  action: AuditAction;
  params: Record<string, string | number | undefined>;
  checkFields: Array<string | number>;
  ctx: CallContext;
}): Promise<MemberApiResult> {
  const effectiveKeyType = resolveKeyType(opts.keyType);
  const check_cd = generateCheckCode(ALGO, effectiveKeyType, opts.checkFields);
  const url = joinUrl(memberBaseUrl(), opts.path);
  const gid = groupId();
  // group_id は全APIに隠しパラメータとして付与可能（仕様書記載なしだが古賀さん確認済み）
  const sendParams = { ...opts.params, ...(gid ? { group_id: gid } : {}), check_cd };

  let result: MemberApiResult = {};
  let errorThrown: unknown = null;
  try {
    const text = await postForm({ url, params: sendParams, fetchImpl: opts.ctx.fetchImpl });
    result = parseXmlResponse(text) as MemberApiResult;
  } catch (e) {
    errorThrown = e;
  }

  // 監査ログには送信内容のうち check_cd（秘匿）を除いた形を記録する。
  // group_id は鍵ではないが署名根拠の一部のため、リクエスト記録に含める。
  const auditRequest = { ...opts.params, ...(gid ? { group_id: gid } : {}) };
  await logPaymentAudit({
    paymentId: opts.ctx.paymentId ?? null,
    action: opts.action,
    request: auditRequest,
    response: errorThrown
      ? { error: errorThrown instanceof Error ? errorThrown.message : String(errorThrown) }
      : result,
    performedBy: opts.ctx.performedBy ?? null,
    ipAddress: opts.ctx.ipAddress ?? null,
  });

  if (errorThrown) throw errorThrown;
  return result;
}

// ============================================================
// 採番
// ============================================================

/**
 * mall_cd ごとの jutyu_cd を採番（DB関数 next_jutyu_cd）。形式 [mall_cd]-[7桁]。
 */
export async function nextJutyuCd(mallCode: string): Promise<string> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("next_jutyu_cd", { p_mall_cd: mallCode });
  if (error) throw new UsenApiError(`jutyu_cd 採番失敗: ${error.message}`);
  if (typeof data !== "string") throw new UsenApiError("jutyu_cd 採番結果が不正です");
  return data;
}

// ============================================================
// 与信・売上（モール鍵、署名対象 jutyu_cd,amount）
// ============================================================

/** /member/authbymemberid: 会員IDで与信照会（★メイン） */
export async function authByMemberId(
  args: { jutyuCd: string; amount: number; memberId: string; jutyuDay?: string; payMethod?: AuthByMemberIdParams["pay_method"] },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const params: Record<string, string | number | undefined> = {
    jutyu_cd: args.jutyuCd,
    amount: args.amount,
    site_cd: siteCd(),
    member_id: args.memberId,
    jutyu_day: args.jutyuDay ?? formatUsenDate(),
    pay_method: args.payMethod,
  };
  const res = await callMemberApi({
    path: "/member/authbymemberid",
    keyType: "mall",
    action: "auth_by_member_id",
    params,
    checkFields: [args.jutyuCd, args.amount],
    ctx,
  });
  if (!isOk(res)) {
    throw new UsenApiError(`与信失敗 (code=${res.code ?? "?"})`, {
      errorCode: res.code,
      responseBody: res,
    });
  }
  return res;
}

/** /sales/salesadd: 売上計上 */
export async function salesAdd(
  args: { jutyuCd: string; amount: number; salesDay?: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const params: SalesAddParams = {
    jutyu_cd: args.jutyuCd,
    amount: args.amount,
    sales_day: args.salesDay ?? formatUsenDate(),
  };
  const res = await callMemberApi({
    path: "/sales/salesadd",
    keyType: "mall",
    action: "sales_add",
    params: params as unknown as Record<string, string | number | undefined>,
    checkFields: [args.jutyuCd, args.amount],
    ctx,
  });
  if (!isOk(res)) {
    throw new UsenApiError(`売上計上失敗 (code=${res.code ?? "?"})`, {
      errorCode: res.code,
      responseBody: res,
    });
  }
  return res;
}

/** /sales/salescancel: 売上取消 */
export async function salesCancel(
  args: { jutyuCd: string; amount: number },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const params: SalesCancelParams = { jutyu_cd: args.jutyuCd, amount: args.amount };
  return callMemberApi({
    path: "/sales/salescancel",
    keyType: "mall",
    action: "sales_cancel",
    params: params as unknown as Record<string, string | number | undefined>,
    checkFields: [args.jutyuCd, args.amount],
    ctx,
  });
}

/** /sales/salesreturn: 売上返品 */
export async function salesReturn(
  args: { jutyuCd: string; amount: number },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  return callMemberApi({
    path: "/sales/salesreturn",
    keyType: "mall",
    action: "sales_return",
    params: { jutyu_cd: args.jutyuCd, amount: args.amount },
    checkFields: [args.jutyuCd, args.amount],
    ctx,
  });
}

/** /auth/void: 与信取消 */
export async function authVoid(
  args: { jutyuCd: string; amount: number; jutyuDay?: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const params: AuthVoidParams = {
    jutyu_cd: args.jutyuCd,
    amount: args.amount,
    jutyu_day: args.jutyuDay ?? formatUsenDate(),
  };
  return callMemberApi({
    path: "/auth/void",
    keyType: "mall",
    action: "auth_void",
    params: params as unknown as Record<string, string | number | undefined>,
    checkFields: [args.jutyuCd, args.amount],
    ctx,
  });
}

/** /search/trade: 取引照会（署名対象は jutyu_cd のみ） */
export async function searchTrade(
  args: { jutyuCd: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const params: SearchTradeParams = { jutyu_cd: args.jutyuCd };
  return callMemberApi({
    path: "/search/trade",
    keyType: "mall",
    action: "search_trade",
    params: params as unknown as Record<string, string | number | undefined>,
    checkFields: [args.jutyuCd],
    ctx,
  });
}

// ============================================================
// 会員操作（サイト鍵、署名対象 site_cd,member_id）
// ============================================================

/** /member/entrybyjutyucd: 与信会員登録（カード登録フローの最後） */
export async function memberEntryByJutyuCd(
  args: { memberId: string; jutyuCd: string; holderName?: string; remarks?: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const site = siteCd();
  const params: MemberEntryParams = {
    site_cd: site,
    member_id: args.memberId,
    jutyu_cd: args.jutyuCd,
    holder_name: args.holderName,
    remarks: args.remarks,
  };
  return callMemberApi({
    path: "/member/entrybyjutyucd",
    keyType: "site",
    action: "member_entry",
    params: params as unknown as Record<string, string | number | undefined>,
    checkFields: [site, args.memberId],
    ctx,
  });
}

/** /member/get: 会員情報取得 */
export async function memberGet(
  args: { memberId: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const site = siteCd();
  const params: MemberGetParams = { site_cd: site, member_id: args.memberId };
  return callMemberApi({
    path: "/member/get",
    keyType: "site",
    action: "member_get",
    params: params as unknown as Record<string, string | number | undefined>,
    checkFields: [site, args.memberId],
    ctx,
  });
}

/** /member/inactivate: 会員無効化 */
export async function memberInactivate(
  args: { memberId: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const site = siteCd();
  return callMemberApi({
    path: "/member/inactivate",
    keyType: "site",
    action: "member_inactivate",
    params: { site_cd: site, member_id: args.memberId },
    checkFields: [site, args.memberId],
    ctx,
  });
}

/** /member/activate: 会員有効化 */
export async function memberActivate(
  args: { memberId: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const site = siteCd();
  return callMemberApi({
    path: "/member/activate",
    keyType: "site",
    action: "member_activate",
    params: { site_cd: site, member_id: args.memberId },
    checkFields: [site, args.memberId],
    ctx,
  });
}

/** /member/delete: 会員情報削除 */
export async function memberDelete(
  args: { memberId: string },
  ctx: CallContext = {}
): Promise<MemberApiResult> {
  const site = siteCd();
  return callMemberApi({
    path: "/member/delete",
    keyType: "site",
    action: "member_delete",
    params: { site_cd: site, member_id: args.memberId },
    checkFields: [site, args.memberId],
    ctx,
  });
}
