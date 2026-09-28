/**
 * USEN ec-payment-web-adapter-token の最小型定義と読み込み（トークン式EC決済API仕様書 10章）
 */

/** OnPaymentError で渡されるエラー */
export interface UsenPaymentError {
  type?: string;
  detail?: unknown;
}

/** SDK のアダプタ */
export interface TokenAdapter {
  setOnChallengeStart(cb: () => void): void;
  setOnPaymentStart(cb: (jutyuCd: string, checkCd: string, token: string | null) => void): void;
  setOnPaymentError(cb: (err: UsenPaymentError) => void): void;
  generateCardInputIframe(styles: object, texts: object, placeholders?: object): void;
  generateToken(): Promise<{ result: string; code: string; token: string; message?: string | null }>;
  startPaymentProcess(args: {
    jutyuCd: string;
    cardLimitYyyy: string;
    cardLimitMm: string;
    cardholderName: string;
    token: string;
  }): void;
}

/** SDK のグローバル */
export interface NetmoveGlobal {
  EcPaymentWebAdapterToken: new (opts: {
    mallCd: string;
    merchantApiBaseUrl: string;
    challengeIframeContainerId: string;
    cardInputIframeContainerId: string;
    apiBaseUrl?: string | null;
  }) => TokenAdapter;
}

/**
 * window.netmove を読む。既存のカード登録画面が同名のグローバル型を宣言しているため、
 * ここでは declare global を使わずにローカルの型で参照する。
 */
function netmoveOf(): NetmoveGlobal | undefined {
  return (window as unknown as { netmove?: NetmoveGlobal }).netmove;
}

/**
 * SDK スクリプトを読み込む（読み込み済みなら何もしない）。
 */
export function loadUsenSdk(url: string): Promise<NetmoveGlobal> {
  return new Promise((resolve, reject) => {
    const loaded = netmoveOf();
    if (loaded) {
      resolve(loaded);
      return;
    }
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      const nm = netmoveOf();
      if (nm) resolve(nm);
      else reject(new Error("SDK not found"));
    };
    script.onerror = () => reject(new Error("SDK load failed"));
    document.body.appendChild(script);
  });
}

/** 既知のエラー種別に丸める（サーバ側の検証値に合わせる） */
export function normalizeErrorType(err: UsenPaymentError): string {
  const known = ["NG_3DS_BRW_INIT", "NG_3DS_BRW_AUTH", "NETWORK", "UNEXPECTED"];
  return err.type && known.includes(err.type) ? err.type : "UNEXPECTED";
}

/** カード名義を仕様（半角英数2〜45桁）に合わせる。空白・記号は除き大文字にする */
export function normalizeCardholderName(value: string): string {
  return value
    .normalize("NFKC")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 45);
}

/**
 * OnPaymentError の詳細を調査用に要約する（USEN の result/code/message 程度。カード情報は含まれない）。
 */
export function summarizeErrorDetail(err: UsenPaymentError): string {
  try {
    const d = err.detail as Record<string, unknown> | undefined;
    const data = (d && typeof d === "object" && "response" in d
      ? (d.response as { data?: unknown; status?: unknown })
      : d) as Record<string, unknown> | undefined;
    return JSON.stringify(data ?? null).slice(0, 300);
  } catch {
    return "";
  }
}
