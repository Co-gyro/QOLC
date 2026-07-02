/**
 * 軽量なインメモリ レートリミッタ。
 *
 * 公開エンドポイントの連投を弾く簡易実装。プロセスメモリ上のスライディング
 * ウィンドウで、同一キー（IP等）からの一定時間内のリクエスト数を制限する。
 * 分散環境では厳密ではないが、単純な連投・スクリプト対策として有効。
 */

/** キーごとの直近リクエスト時刻（ミリ秒）を保持する。 */
const hits = new Map<string, number[]>();

/** レートリミット判定オプション。 */
export interface RateLimitOptions {
  /** ウィンドウ長（ミリ秒）。既定60秒。 */
  windowMs?: number;
  /** ウィンドウ内で許容する最大リクエスト数。既定5。 */
  max?: number;
}

/** レートリミット判定結果。 */
export interface RateLimitResult {
  /** 許可されたか。 */
  allowed: boolean;
  /** 次に許可されるまでの目安秒数（超過時のみ意味を持つ）。 */
  retryAfterSec: number;
}

/**
 * 指定キーのアクセス可否を判定し、許可時はカウントを加算する。
 * @param key 識別キー（IPアドレス等）
 * @param options ウィンドウ長と上限
 * @returns 許可可否とリトライ目安
 */
export function checkRateLimit(key: string, options: RateLimitOptions = {}): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const max = options.max ?? 5;
  const now = Date.now();
  const cutoff = now - windowMs;

  const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= max) {
    const oldest = recent[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    hits.set(key, recent);
    return { allowed: false, retryAfterSec };
  }

  recent.push(now);
  hits.set(key, recent);

  // まれにマップが肥大化しないよう、期限切れのみのキーは間引く
  if (hits.size > 5000) {
    hits.forEach((v: number[], k: string) => {
      if (v.every((t: number) => t <= cutoff)) hits.delete(k);
    });
  }

  return { allowed: true, retryAfterSec: 0 };
}
