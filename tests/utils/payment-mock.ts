/**
 * USEN PSP API レスポンスのモック
 */

/** 成功レスポンス（与信成功） */
export const PAYMENT_SUCCESS_RESPONSE = {
  res_cd: "S",
  trade_id: "TID-TEST-0001",
};

/** 失敗レスポンス（与信エラー） */
export const PAYMENT_FAILURE_RESPONSE = {
  res_cd: "E",
  err_cd: "E0001",
  err_msg: "カード残高不足",
};

/** カード登録初期化の成功レスポンス */
export const TOKEN_INIT_SUCCESS = {
  res_cd: "S",
  redirect_url: "https://inet-uketsuke.netmove.jp/ec-payment-uhup/redirect/abc123",
  trade_id: "TID-TOKEN-0001",
};

/** カード登録結果取得の成功レスポンス */
export const TOKEN_RESULT_SUCCESS = {
  res_cd: "S",
  auth_status: "AUTHORIZED",
  member_id: "MEMBER-TEST-0001",
  trade_id: "TID-TOKEN-0001",
};

/** タイムアウト相当の fetch（テスト用） */
export function makeTimeoutFetch(): typeof fetch {
  return (async () => {
    throw new Error("timeout");
  }) as unknown as typeof fetch;
}

/**
 * 固定レスポンスを返す fetch を生成
 */
export function makeFixedFetch(
  responseBody: Record<string, string>,
  status = 200
): typeof fetch {
  return (async () => {
    const body = Object.entries(responseBody)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    return new Response(body, {
      status,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
  }) as unknown as typeof fetch;
}
