/**
 * USEN PSP EC決済API クライアント（カード登録用、トークン式）
 *
 * 認証: HMAC-SHA256
 * 用途: 新規カード登録（3Dセキュア必須）
 *
 * カード登録フロー:
 *   1. /i/token/init で 1円与信＋3DS開始 → redirect_url 受領
 *   2. ユーザーを redirect_url にリダイレクト（カード番号入力 + 3DS認証）
 *   3. コールバック受信後、/i/result で結果取得
 *   4. 成功 → /member/entrybyjutyucd で会員登録
 *   5. /auth/void で1円与信を即取消
 */
import { callUsenApi, joinUrl, isUsenSuccess } from "./usen-client";
import { logPaymentAudit } from "./audit-log";
import { UsenApiError } from "./errors";
import type {
  TokenInitRequest,
  TokenInitResponse,
  TokenResultRequest,
  TokenResultResponse,
  AuditAction,
} from "./types";

const ALGORITHM = "sha256" as const;

function tokenBaseUrl(): string {
  const url = process.env.USEN_TOKEN_API_BASE_URL;
  if (!url) throw new UsenApiError("USEN_TOKEN_API_BASE_URL 未設定");
  return url;
}

function siteAndMall(overrideMall?: string): { site_cd: string; mall_cd: string } {
  const site_cd = process.env.USEN_SITE_CD;
  if (!site_cd) throw new UsenApiError("USEN_SITE_CD 未設定");
  const mall_cd = overrideMall ?? process.env.USEN_MALL_CD;
  if (!mall_cd) throw new UsenApiError("mall_cd 未解決");
  return { site_cd, mall_cd };
}

async function callAndLog<TReq extends object, TResp extends { res_cd?: string }>(
  path: string,
  action: AuditAction,
  request: TReq,
  ctx: {
    paymentId?: string | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    fetchImpl?: typeof fetch;
  }
): Promise<TResp> {
  const url = joinUrl(tokenBaseUrl(), path);
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
      fetchImpl: ctx.fetchImpl,
    });
  } catch (e) {
    errorThrown = e;
    resp = {} as TResp;
  }
  await logPaymentAudit({
    paymentId: ctx.paymentId ?? null,
    action,
    request,
    response: errorThrown
      ? { error: errorThrown instanceof Error ? errorThrown.message : String(errorThrown) }
      : resp,
    performedBy: ctx.performedBy ?? null,
    ipAddress: ctx.ipAddress ?? null,
  });
  if (errorThrown) throw errorThrown;
  return resp;
}

/**
 * /i/token/init: カード登録の初期化（1円与信 + 3DS開始）
 *
 * @param args.jutyu_cd  既に採番済みの受注コード
 * @param args.retUrl    USENからのコールバック先URL（カード入力完了後）
 */
export async function tokenInit(
  args: { jutyu_cd: string; retUrl: string; mall_cd?: string },
  ctx: {
    paymentId?: string | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<TokenInitResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: TokenInitRequest = {
    site_cd,
    mall_cd,
    jutyu_cd: args.jutyu_cd,
    amount: 1,
    acs_flg: "1",
    ret_url: args.retUrl,
  };
  const resp = await callAndLog<TokenInitRequest, TokenInitResponse>(
    "/i/token/init",
    "token_init",
    req,
    ctx
  );
  if (!isUsenSuccess(resp) || !resp.redirect_url) {
    throw new UsenApiError(
      `トークン初期化失敗: ${resp.err_msg ?? resp.res_cd ?? "unknown"}`,
      { errorCode: resp.err_cd ?? resp.res_cd, responseBody: resp }
    );
  }
  return resp;
}

/**
 * /i/result: カード登録結果取得（コールバック後）
 * 成功時は member_id を返す。
 */
export async function tokenResult(
  args: { jutyu_cd: string; mall_cd?: string },
  ctx: {
    paymentId?: string | null;
    performedBy?: string | null;
    ipAddress?: string | null;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<TokenResultResponse> {
  const { site_cd, mall_cd } = siteAndMall(args.mall_cd);
  const req: TokenResultRequest = { site_cd, mall_cd, jutyu_cd: args.jutyu_cd };
  return callAndLog<TokenResultRequest, TokenResultResponse>(
    "/i/result",
    "token_result",
    req,
    ctx
  );
}
