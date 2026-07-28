-- ============================================================
-- 034: UD Payment（仮）常設デモのストア（udpay_demo_store）
--
-- ランサイド様提案用デモ（app.qolc.jp/udpay）の状態保存。
-- デモは外部決済に一切接続しない模擬環境で、顧客・請求・決済の全状態を
-- 1行の JSONB（id='main'）として保持する（ローカル開発ではファイルストアを使用）。
-- seed_version はシード構造の版。アプリ側が不一致を検知したら再シードする。
-- 読み書きは service_role の API（/api/udpay とサーバーコンポーネント）のみ。
-- RLS を有効化し anon/authenticated ポリシーは付与しない（029 と同方針）。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.udpay_demo_store (
  id            TEXT PRIMARY KEY DEFAULT 'main',
  data          JSONB NOT NULL,
  seed_version  INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.udpay_demo_store ENABLE ROW LEVEL SECURITY;

-- 管理者のみ直接参照可（通常の読み書きは service_role がRLSをバイパスして行う）
DO $$
BEGIN
  CREATE POLICY p_udpay_demo_store_admin_all ON public.udpay_demo_store
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
