-- ============================================================
-- 041: 加盟店の契約・ライセンス（加盟店カルテ 段階2）
--
-- 加盟店ごとに、利用しているサービスの契約を1行ずつ持つ。
--   サービス: qolc（介護施設向け）/ udpay（UD Payment 請求・カード決済）/ merchant_api（加盟店API）/ store_terminal（店頭決済・将来）
--   状態: preparing=準備中 / active=稼働中 / suspended=一時停止 / terminated=解約
--   ライセンス: プラン名・利用人数の上限（NULL=上限なし）
-- 金額・料率は持たない（経営判断の領域。料率は申請の ud_input／Selfish が正）。
--
-- 適用: Supabase ダッシュボードの SQL Editor に貼り付けて実行（何度実行しても同じ結果）。
-- ============================================================

DO $$ BEGIN
  CREATE TYPE merchant_service_kind AS ENUM ('qolc', 'udpay', 'merchant_api', 'store_terminal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE merchant_service_status AS ENUM ('preparing', 'active', 'suspended', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.merchant_services (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID NOT NULL REFERENCES public.merchants(id),
  service      merchant_service_kind NOT NULL,
  status       merchant_service_status NOT NULL DEFAULT 'preparing',
  plan_name    VARCHAR(100),
  -- 利用人数（ログインアカウント数）の上限。NULL は上限なし
  seat_limit   INTEGER CHECK (seat_limit IS NULL OR seat_limit >= 0),
  started_on   DATE,
  ended_on     DATE,
  notes        TEXT,
  created_by   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  CONSTRAINT chk_merchant_services_period CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);

-- 1加盟店につき、同じサービスの有効な契約は1つ
CREATE UNIQUE INDEX IF NOT EXISTS uq_merchant_services_merchant_service
  ON public.merchant_services (merchant_id, service)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_merchant_services_updated_at ON public.merchant_services;
CREATE TRIGGER trg_merchant_services_updated_at
  BEFORE UPDATE ON public.merchant_services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.merchant_services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_merchant_services_admin ON public.merchant_services;
CREATE POLICY p_merchant_services_admin ON public.merchant_services
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 既存の加盟店の契約を登録（既にあれば何もしない）
-- 株式会社ランサイド（A303）: UD Payment・稼働中
INSERT INTO public.merchant_services (merchant_id, service, status, plan_name, started_on, notes)
SELECT id, 'udpay', 'active', 'UD Payment', DATE '2026-10-20', '担当者2名・承認者1名で運用開始'
FROM public.merchants WHERE mall_code = 'A303' AND deleted_at IS NULL
ON CONFLICT DO NOTHING;

-- 株式会社DD（A304）: 加盟店API・稼働中
INSERT INTO public.merchant_services (merchant_id, service, status, plan_name, started_on, notes)
SELECT id, 'merchant_api', 'active', '加盟店API（チケット決済）', DATE '2026-10-08', 'AINY LIVE（本番の接続情報を10/8発行）'
FROM public.merchants WHERE mall_code = 'A304' AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
