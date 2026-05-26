-- ============================================================
-- 016_fix_cross_table_rls_recursion.sql
-- テーブル間 RLS 相互参照による無限再帰の解消
--
-- 問題:
--   resident_accounts のポリシーが residents を参照し、residents のポリシーが
--   resident_accounts を参照するため、評価が循環して無限再帰になる。
--   同様の相互参照が payments/receipts/statement_lines/notifications/
--   upload_batches/facilities/merchants にも存在する。
--
-- 対策:
--   ポリシー内の「他テーブルへの EXISTS」を SECURITY DEFINER ヘルパー関数に置き換え、
--   関数内の参照では RLS を発火させないことで循環を断ち切る。
-- ============================================================

-- ------------------------------------------------------------
-- SECURITY DEFINER ヘルパー関数（RLSをバイパスして関連を判定）
-- ------------------------------------------------------------

-- 入居者の所属施設ID
CREATE OR REPLACE FUNCTION public.fn_resident_facility(p_resident UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT facility_id FROM public.residents WHERE id = p_resident;
$$;

-- 現在のユーザーがこの入居者の resident_account を保有するか（family用）
CREATE OR REPLACE FUNCTION public.fn_user_owns_resident(p_resident UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_accounts ra
    WHERE ra.resident_id = p_resident
      AND ra.user_id = auth.uid()
      AND ra.deleted_at IS NULL
  );
$$;

-- 現在のユーザーがこの resident_account の保有者か（notifications用）
CREATE OR REPLACE FUNCTION public.fn_user_owns_account(p_account UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.resident_accounts ra
    WHERE ra.id = p_account AND ra.user_id = auth.uid()
  );
$$;

-- 現在の provider(merchant) がこの施設にアクティブに紐づくか
CREATE OR REPLACE FUNCTION public.fn_merchant_has_facility(p_facility UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.facility_merchant_relations r
    WHERE r.facility_id = p_facility
      AND r.merchant_id = public.jwt_merchant_id()
      AND r.status = 'active'
  );
$$;

-- 現在の facility_staff(facility) がこの加盟店にアクティブに紐づくか
CREATE OR REPLACE FUNCTION public.fn_facility_has_merchant(p_merchant UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.facility_merchant_relations r
    WHERE r.merchant_id = p_merchant
      AND r.facility_id = public.jwt_facility_id()
      AND r.status = 'active'
  );
$$;

-- アップロードバッチの加盟店ID
CREATE OR REPLACE FUNCTION public.fn_batch_merchant(p_batch UUID)
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT merchant_id FROM public.upload_batches WHERE id = p_batch;
$$;

-- ------------------------------------------------------------
-- ポリシー再定義（他テーブル EXISTS → ヘルパー関数）
-- ------------------------------------------------------------

-- facilities: provider 読み取り
DROP POLICY IF EXISTS p_facilities_provider_read ON public.facilities;
CREATE POLICY p_facilities_provider_read ON public.facilities
  FOR SELECT USING (
    public.jwt_role() = 'provider' AND public.fn_merchant_has_facility(facilities.id)
  );

-- residents: provider 読み取り / family 読み取り
DROP POLICY IF EXISTS p_residents_provider_read ON public.residents;
CREATE POLICY p_residents_provider_read ON public.residents
  FOR SELECT USING (
    public.jwt_role() = 'provider' AND public.fn_merchant_has_facility(residents.facility_id)
  );

DROP POLICY IF EXISTS p_residents_family_read ON public.residents;
CREATE POLICY p_residents_family_read ON public.residents
  FOR SELECT USING (
    public.jwt_role() = 'family' AND public.fn_user_owns_resident(residents.id)
  );

-- resident_accounts: facility_staff 読み取り
DROP POLICY IF EXISTS p_resident_accounts_facility_staff_read ON public.resident_accounts;
CREATE POLICY p_resident_accounts_facility_staff_read ON public.resident_accounts
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND public.fn_resident_facility(resident_accounts.resident_id) = public.jwt_facility_id()
  );

-- merchants: facility_staff 読み取り
DROP POLICY IF EXISTS p_merchants_facility_staff_read ON public.merchants;
CREATE POLICY p_merchants_facility_staff_read ON public.merchants
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff' AND public.fn_facility_has_merchant(merchants.id)
  );

-- upload_batches: facility_staff
DROP POLICY IF EXISTS p_upload_batches_facility_staff ON public.upload_batches;
CREATE POLICY p_upload_batches_facility_staff ON public.upload_batches
  FOR ALL USING (
    public.jwt_role() = 'facility_staff' AND public.fn_facility_has_merchant(upload_batches.merchant_id)
  ) WITH CHECK (
    public.jwt_role() = 'facility_staff' AND public.fn_facility_has_merchant(upload_batches.merchant_id)
  );

-- statement_lines: provider 読み取り / family 読み取り
DROP POLICY IF EXISTS p_statement_lines_provider_read ON public.statement_lines;
CREATE POLICY p_statement_lines_provider_read ON public.statement_lines
  FOR SELECT USING (
    public.jwt_role() = 'provider'
    AND public.fn_batch_merchant(statement_lines.upload_batch_id) = public.jwt_merchant_id()
  );

DROP POLICY IF EXISTS p_statement_lines_family_read ON public.statement_lines;
CREATE POLICY p_statement_lines_family_read ON public.statement_lines
  FOR SELECT USING (
    public.jwt_role() = 'family' AND public.fn_user_owns_resident(statement_lines.resident_id)
  );

-- payments: facility_staff 読み取り / family 読み取り
DROP POLICY IF EXISTS p_payments_facility_staff_read ON public.payments;
CREATE POLICY p_payments_facility_staff_read ON public.payments
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND public.fn_resident_facility(payments.resident_id) = public.jwt_facility_id()
  );

DROP POLICY IF EXISTS p_payments_family_read ON public.payments;
CREATE POLICY p_payments_family_read ON public.payments
  FOR SELECT USING (
    public.jwt_role() = 'family' AND public.fn_user_owns_resident(payments.resident_id)
  );

-- receipts: facility_staff 読み取り / family 読み取り
DROP POLICY IF EXISTS p_receipts_facility_staff_read ON public.receipts;
CREATE POLICY p_receipts_facility_staff_read ON public.receipts
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND public.fn_resident_facility(receipts.resident_id) = public.jwt_facility_id()
  );

DROP POLICY IF EXISTS p_receipts_family_read ON public.receipts;
CREATE POLICY p_receipts_family_read ON public.receipts
  FOR SELECT USING (
    public.jwt_role() = 'family' AND public.fn_user_owns_resident(receipts.resident_id)
  );

-- notifications: 自己読み取り / 自己更新
DROP POLICY IF EXISTS p_notifications_self_read ON public.notifications;
CREATE POLICY p_notifications_self_read ON public.notifications
  FOR SELECT USING (public.fn_user_owns_account(notifications.resident_account_id));

DROP POLICY IF EXISTS p_notifications_self_update ON public.notifications;
CREATE POLICY p_notifications_self_update ON public.notifications
  FOR UPDATE USING (public.fn_user_owns_account(notifications.resident_account_id));
