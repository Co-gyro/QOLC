-- ============================================================
-- 032_extend_merchants_for_review.sql
-- 加盟店・審査管理の拡張（業務OS化 Step1+Step2）。
--   1) merchants: JCB加盟店番号2種（登録型/都度型EC）の対応付けを明確化
--      ※ 005 で jcb_merchant_code_ec / jcb_merchant_code_recurring が既に存在
--        するため、新規列は追加せずコメントで用途を確定する（リネーム禁止）。
--        - 登録型（会員ID決済・継続課金用）   → jcb_merchant_code_recurring
--        - 都度型EC（トークン決済用）         → jcb_merchant_code_ec
--   2) merchant_applications: 審査管理に必要な列を追加
--      （提出日 / 審査結果 / 結果受領日 / NG理由 / 申請ハブ案件との紐付け /
--        ソフトデリート）
-- 冪等（再実行可）。CLI未リンクのため SQL Editor 手動適用が前提。
-- ============================================================

-- ---- 1) merchants: JCB加盟店番号2種の用途を確定 --------------------------------
COMMENT ON COLUMN public.merchants.jcb_merchant_code_recurring IS
  'JCB加盟店番号（登録型）: 会員ID決済・継続課金用。審査結果で発番される2種のうちの1つ';
COMMENT ON COLUMN public.merchants.jcb_merchant_code_ec IS
  'JCB加盟店番号（都度型EC）: カード登録時のトークン決済用。審査結果で発番される2種のうちの1つ';

-- ---- 2) merchant_applications: 審査管理列の追加 --------------------------------
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;          -- JCB/セゾンへの申請書提出日
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS result TEXT
    CHECK (result IN ('approved', 'rejected'));               -- 審査結果（NULL=結果待ち）
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS result_received_at TIMESTAMPTZ;    -- 審査結果の受領日
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS ng_reason TEXT;                    -- NG理由（result='rejected' 時）
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS application_id UUID
    REFERENCES public.applications(id);                       -- 申請ハブ案件との紐付け（任意）
ALTER TABLE public.merchant_applications
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;            -- ソフトデリート（005 で欠落）

COMMENT ON COLUMN public.merchant_applications.submitted_at IS 'JCB/セゾンへの申請書提出日';
COMMENT ON COLUMN public.merchant_applications.result IS '審査結果: approved / rejected（NULL=結果待ち）';
COMMENT ON COLUMN public.merchant_applications.result_received_at IS '審査結果の受領日';
COMMENT ON COLUMN public.merchant_applications.ng_reason IS 'NG理由（result=rejected のとき記録）';
COMMENT ON COLUMN public.merchant_applications.application_id IS '申請/タスクハブ（applications）の案件ID';

CREATE INDEX IF NOT EXISTS idx_merchant_applications_merchant
  ON public.merchant_applications (merchant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_merchant_applications_application
  ON public.merchant_applications (application_id) WHERE deleted_at IS NULL;
