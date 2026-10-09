-- ============================================================
-- 039: UD Payment 本番カード登録（顧客の住所・カード有効期限・加盟店設定）
--
-- ※ 038 は QOLC Wallet（feature/wallet-demo・未マージ）が使用しているため 039 とする。
-- 前提: 037_create_udpay_tables.sql 適用済み。
-- 適用: Supabase ダッシュボードの SQL Editor に貼り付けて実行（CLI 未リンク運用）。
-- ============================================================

-- 顧客: 領収証の宛先住所、登録カードの下4桁・有効期限（USEN 会員情報取得で取得）
-- カード番号は保持しない（マスク済みの下4桁と有効期限のみ）
ALTER TABLE public.udpay_customers
  ADD COLUMN IF NOT EXISTS postal_code     VARCHAR(8),
  ADD COLUMN IF NOT EXISTS address1        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS address2        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS card_last4      CHAR(4),
  ADD COLUMN IF NOT EXISTS card_expire_ym  CHAR(6)
    CHECK (card_expire_ym IS NULL OR card_expire_ym ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  ADD COLUMN IF NOT EXISTS card_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.udpay_customers.card_expire_ym IS
  '登録カードの有効期限 YYYYMM（USEN /member/get の expire_yyyy/expire_mm）。期限間近の案内に使う';

-- 加盟店ごとの UD Payment 設定（選べる決済日・帳票の発行元表示）
CREATE TABLE IF NOT EXISTS public.udpay_merchant_settings (
  merchant_id          UUID PRIMARY KEY REFERENCES public.merchants(id),
  -- 顧客に設定できる決済日（例: ランサイド様は {15,28}）
  charge_days          SMALLINT[] NOT NULL DEFAULT '{15,28}'
    CHECK (array_length(charge_days, 1) >= 1 AND 1 <= ALL(charge_days) AND 28 >= ALL(charge_days)),
  -- 帳票・メールに出す発行元の表示（未設定は merchants の値を使う）
  display_name         VARCHAR(100),
  contact_person       VARCHAR(50),
  logo_path            VARCHAR(200),
  -- メールの返信先（加盟店の担当窓口）
  reply_to             VARCHAR(254),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS trg_udpay_merchant_settings_updated_at ON public.udpay_merchant_settings;
CREATE TRIGGER trg_udpay_merchant_settings_updated_at
  BEFORE UPDATE ON public.udpay_merchant_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.udpay_merchant_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS p_udpay_merchant_settings_rw ON public.udpay_merchant_settings;
CREATE POLICY p_udpay_merchant_settings_rw ON public.udpay_merchant_settings
  FOR ALL USING (public.is_admin() OR merchant_id = public.udpay_my_merchant_id())
  WITH CHECK (public.is_admin());

-- 株式会社ランサイド（モールコード A303）を UD Payment 加盟店として登録
INSERT INTO public.udpay_merchant_settings (merchant_id, charge_days, display_name, contact_person, logo_path)
SELECT id, '{15,28}', '株式会社ランサイド', '永村隆司', '/udpay/runside-logo.png'
FROM public.merchants
WHERE mall_code = 'A303' AND deleted_at IS NULL
ON CONFLICT (merchant_id) DO NOTHING;
