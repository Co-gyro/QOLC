-- ============================================================
-- 022_add_merchant_receipt_fields.sql
-- 加盟店(merchants)に領収書まわりの2項目を追加:
--   - invoice_registration_number : 適格請求書発行事業者 登録番号(T+13桁)。
--       請求書/領収書のインボイス表記(発行者=提供者の登録番号)に使用。
--   - receipt_category            : 領収書の既定区分(kaigo/iryou/jihi)。
--       領収書カテゴリの自動判定に使用(NULLは給付額からの推定にフォールバック)。
-- ============================================================
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS invoice_registration_number VARCHAR(14),
  ADD COLUMN IF NOT EXISTS receipt_category            VARCHAR(8);

-- 区分は3値のみ許可(NULL可)。既存制約があれば付け直し。
ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS chk_merchants_receipt_category;
ALTER TABLE public.merchants
  ADD CONSTRAINT chk_merchants_receipt_category
    CHECK (receipt_category IS NULL OR receipt_category IN ('kaigo', 'iryou', 'jihi'));

COMMENT ON COLUMN public.merchants.invoice_registration_number
  IS '適格請求書発行事業者 登録番号(T+13桁)。請求書/領収書のインボイス表記に使用';
COMMENT ON COLUMN public.merchants.receipt_category
  IS '領収書の既定区分(kaigo=介護保険/iryou=医療保険/jihi=自費)。領収書カテゴリ自動判定。NULLは給付額から推定';
