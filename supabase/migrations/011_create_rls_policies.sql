-- ============================================================
-- 011_create_rls_policies.sql
-- Row Level Security 有効化と全テーブルのポリシー
--
-- 設計方針:
--   - JWT の app_metadata に role / facility_id / merchant_id を埋め込む（A-3のhookで実装）
--   - request.jwt.claims から role を取得
--   - admin はバイパス（すべての操作可能）
-- ============================================================

-- ============================================================
-- RLS 有効化
-- ============================================================
ALTER TABLE public.facility_groups               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facilities                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resident_accounts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_applications         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_merchant_relations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_formats                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_batches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_lines               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_audit_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jutyu_cd_counters             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mall_code_pool                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terminal_id_pool              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- JWT から claim を取り出すヘルパー関数
-- ============================================================
CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
    (SELECT role::TEXT FROM public.profiles WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.jwt_facility_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'facility_id',
      (SELECT facility_id::TEXT FROM public.profiles WHERE id = auth.uid())
    ),
    ''
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION public.jwt_merchant_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(
    COALESCE(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'merchant_id',
      (SELECT merchant_id::TEXT FROM public.profiles WHERE id = auth.uid())
    ),
    ''
  )::UUID;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT public.jwt_role() = 'admin';
$$;

-- ============================================================
-- 共通ポリシー: admin は FULL ACCESS
-- ============================================================

-- facility_groups
CREATE POLICY p_facility_groups_admin_all ON public.facility_groups
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- facilities
CREATE POLICY p_facilities_admin_all ON public.facilities
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_facilities_facility_staff_read ON public.facilities
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND id = public.jwt_facility_id()
  );
CREATE POLICY p_facilities_provider_read ON public.facilities
  FOR SELECT USING (
    public.jwt_role() = 'provider'
    AND EXISTS (
      SELECT 1 FROM public.facility_merchant_relations r
      WHERE r.facility_id = facilities.id
        AND r.merchant_id = public.jwt_merchant_id()
        AND r.status = 'active'
    )
  );

-- profiles（自分のプロフィールのみ読み取り可、admin は全件可）
CREATE POLICY p_profiles_admin_all ON public.profiles
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_profiles_self_read ON public.profiles
  FOR SELECT USING (id = auth.uid());

-- residents
CREATE POLICY p_residents_admin_all ON public.residents
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_residents_facility_staff ON public.residents
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND facility_id = public.jwt_facility_id()
  );
CREATE POLICY p_residents_facility_staff_write ON public.residents
  FOR ALL USING (
    public.jwt_role() = 'facility_staff'
    AND facility_id = public.jwt_facility_id()
  ) WITH CHECK (
    public.jwt_role() = 'facility_staff'
    AND facility_id = public.jwt_facility_id()
  );
CREATE POLICY p_residents_provider_read ON public.residents
  FOR SELECT USING (
    public.jwt_role() = 'provider'
    AND EXISTS (
      SELECT 1 FROM public.facility_merchant_relations r
      WHERE r.facility_id = residents.facility_id
        AND r.merchant_id = public.jwt_merchant_id()
        AND r.status = 'active'
    )
  );
CREATE POLICY p_residents_family_read ON public.residents
  FOR SELECT USING (
    public.jwt_role() = 'family'
    AND EXISTS (
      SELECT 1 FROM public.resident_accounts ra
      WHERE ra.resident_id = residents.id
        AND ra.user_id = auth.uid()
        AND ra.deleted_at IS NULL
    )
  );

-- resident_accounts
CREATE POLICY p_resident_accounts_admin_all ON public.resident_accounts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_resident_accounts_facility_staff_read ON public.resident_accounts
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = resident_accounts.resident_id
        AND r.facility_id = public.jwt_facility_id()
    )
  );
CREATE POLICY p_resident_accounts_self_read ON public.resident_accounts
  FOR SELECT USING (user_id = auth.uid());
-- 家族は自分のレコードのカード登録情報（usen_member_id等）を更新可
CREATE POLICY p_resident_accounts_self_update ON public.resident_accounts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- merchants
CREATE POLICY p_merchants_admin_all ON public.merchants
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_merchants_provider_self_read ON public.merchants
  FOR SELECT USING (
    public.jwt_role() = 'provider'
    AND id = public.jwt_merchant_id()
  );
CREATE POLICY p_merchants_facility_staff_read ON public.merchants
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND EXISTS (
      SELECT 1 FROM public.facility_merchant_relations r
      WHERE r.merchant_id = merchants.id
        AND r.facility_id = public.jwt_facility_id()
        AND r.status = 'active'
    )
  );

-- merchant_applications
CREATE POLICY p_merchant_applications_admin_all ON public.merchant_applications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- facility_merchant_relations
CREATE POLICY p_facility_merchant_relations_admin_all ON public.facility_merchant_relations
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_facility_merchant_relations_facility_read ON public.facility_merchant_relations
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND facility_id = public.jwt_facility_id()
  );
CREATE POLICY p_facility_merchant_relations_provider_read ON public.facility_merchant_relations
  FOR SELECT USING (
    public.jwt_role() = 'provider'
    AND merchant_id = public.jwt_merchant_id()
  );

-- upload_formats（マスタなので読み取りは全認証ユーザーに許可、書き込みは admin のみ）
CREATE POLICY p_upload_formats_admin_all ON public.upload_formats
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_upload_formats_authenticated_read ON public.upload_formats
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- upload_batches
CREATE POLICY p_upload_batches_admin_all ON public.upload_batches
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_upload_batches_provider ON public.upload_batches
  FOR ALL USING (
    public.jwt_role() = 'provider'
    AND merchant_id = public.jwt_merchant_id()
  ) WITH CHECK (
    public.jwt_role() = 'provider'
    AND merchant_id = public.jwt_merchant_id()
  );
CREATE POLICY p_upload_batches_facility_staff ON public.upload_batches
  FOR ALL USING (
    public.jwt_role() = 'facility_staff'
    AND EXISTS (
      SELECT 1 FROM public.facility_merchant_relations r
      WHERE r.merchant_id = upload_batches.merchant_id
        AND r.facility_id = public.jwt_facility_id()
        AND r.status = 'active'
    )
  ) WITH CHECK (
    public.jwt_role() = 'facility_staff'
    AND EXISTS (
      SELECT 1 FROM public.facility_merchant_relations r
      WHERE r.merchant_id = upload_batches.merchant_id
        AND r.facility_id = public.jwt_facility_id()
        AND r.status = 'active'
    )
  );

-- statement_lines
CREATE POLICY p_statement_lines_admin_all ON public.statement_lines
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_statement_lines_facility_staff_read ON public.statement_lines
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND facility_id = public.jwt_facility_id()
  );
CREATE POLICY p_statement_lines_provider_read ON public.statement_lines
  FOR SELECT USING (
    public.jwt_role() = 'provider'
    AND EXISTS (
      SELECT 1 FROM public.upload_batches b
      WHERE b.id = statement_lines.upload_batch_id
        AND b.merchant_id = public.jwt_merchant_id()
    )
  );
CREATE POLICY p_statement_lines_family_read ON public.statement_lines
  FOR SELECT USING (
    public.jwt_role() = 'family'
    AND EXISTS (
      SELECT 1 FROM public.resident_accounts ra
      WHERE ra.resident_id = statement_lines.resident_id
        AND ra.user_id = auth.uid()
        AND ra.deleted_at IS NULL
    )
  );

-- payments
CREATE POLICY p_payments_admin_all ON public.payments
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_payments_facility_staff_read ON public.payments
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = payments.resident_id
        AND r.facility_id = public.jwt_facility_id()
    )
  );
CREATE POLICY p_payments_provider_read ON public.payments
  FOR SELECT USING (
    public.jwt_role() = 'provider'
    AND merchant_id = public.jwt_merchant_id()
  );
CREATE POLICY p_payments_family_read ON public.payments
  FOR SELECT USING (
    public.jwt_role() = 'family'
    AND EXISTS (
      SELECT 1 FROM public.resident_accounts ra
      WHERE ra.resident_id = payments.resident_id
        AND ra.user_id = auth.uid()
        AND ra.deleted_at IS NULL
    )
  );

-- payment_audit_logs（読み取りは admin のみ、書き込みは service_role 経由）
CREATE POLICY p_payment_audit_logs_admin_read ON public.payment_audit_logs
  FOR SELECT USING (public.is_admin());
-- INSERT も admin のみ（API Routeでは service_role キーを使うのでRLSバイパス）
CREATE POLICY p_payment_audit_logs_admin_insert ON public.payment_audit_logs
  FOR INSERT WITH CHECK (public.is_admin());
-- UPDATE / DELETE ポリシーは存在しない → 誰も改ざんできない（admin も含む）

-- jutyu_cd_counters（service_role 経由でのみアクセス想定。デフォルト deny）
CREATE POLICY p_jutyu_cd_counters_admin_read ON public.jutyu_cd_counters
  FOR SELECT USING (public.is_admin());

-- receipts
CREATE POLICY p_receipts_admin_all ON public.receipts
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_receipts_facility_staff_read ON public.receipts
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = receipts.resident_id
        AND r.facility_id = public.jwt_facility_id()
    )
  );
CREATE POLICY p_receipts_family_read ON public.receipts
  FOR SELECT USING (
    public.jwt_role() = 'family'
    AND EXISTS (
      SELECT 1 FROM public.resident_accounts ra
      WHERE ra.resident_id = receipts.resident_id
        AND ra.user_id = auth.uid()
        AND ra.deleted_at IS NULL
    )
  );

-- notifications
CREATE POLICY p_notifications_admin_all ON public.notifications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_notifications_self_read ON public.notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.resident_accounts ra
      WHERE ra.id = notifications.resident_account_id
        AND ra.user_id = auth.uid()
    )
  );
CREATE POLICY p_notifications_self_update ON public.notifications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.resident_accounts ra
      WHERE ra.id = notifications.resident_account_id
        AND ra.user_id = auth.uid()
    )
  );

-- mall_code_pool / terminal_id_pool（admin のみ）
CREATE POLICY p_mall_code_pool_admin_all ON public.mall_code_pool
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY p_terminal_id_pool_admin_all ON public.terminal_id_pool
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- payment_audit_logs の DELETE 権限を全 role から剥奪
-- service_role でさえ DELETE できないよう、PG レベルの権限制御を併用
-- ============================================================
REVOKE DELETE ON public.payment_audit_logs FROM authenticated, anon, service_role;
