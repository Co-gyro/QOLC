-- ============================================================
-- 015_fix_rls_helper_recursion.sql
-- RLS ヘルパー関数の無限再帰を修正
--
-- 問題:
--   jwt_role() / jwt_facility_id() / jwt_merchant_id() は profiles を参照するが、
--   profiles の RLS ポリシーが is_admin()→jwt_role()→profiles参照... と再帰し、
--   "infinite recursion detected in policy for relation" エラーになる。
--
-- 対策:
--   これらの関数を SECURITY DEFINER にして、関数内の profiles 参照では
--   RLS を発火させない（所有者権限で実行）。これで再帰を断ち切る。
-- ============================================================

CREATE OR REPLACE FUNCTION public.jwt_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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
SECURITY DEFINER
SET search_path = public, pg_temp
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
SECURITY DEFINER
SET search_path = public, pg_temp
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
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.jwt_role() = 'admin';
$$;
