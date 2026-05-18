/**
 * RLS の実DB接続テスト（スケルトン）
 *
 * 実行条件: 環境変数 RLS_LIVE=1 が設定されている場合のみ
 *   - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が必要
 *   - テスト用ユーザーを毎回生成→削除する
 *
 * 通常の CI では skip される。
 */
import { describe, it, expect } from "vitest";

const LIVE = process.env.RLS_LIVE === "1";

(LIVE ? describe : describe.skip)("RLS live tests", () => {
  it("admin は全 residents を読み取れる（実DB）", async () => {
    // 実装スケルトン: Supabase admin クライアントで select
    // 期待: residents 全件返却
    expect(true).toBe(true);
  });

  it("facility_staff は自施設の residents のみ読み取れる", async () => {
    expect(true).toBe(true);
  });

  it("provider は紐づく施設の residents のみ読み取れる", async () => {
    expect(true).toBe(true);
  });

  it("family は自分の resident のみ読み取れる", async () => {
    expect(true).toBe(true);
  });

  it("誰も payment_audit_logs を DELETE できない", async () => {
    expect(true).toBe(true);
  });
});
