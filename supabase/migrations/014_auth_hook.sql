-- ============================================================
-- 014_auth_hook.sql
-- Supabase Auth カスタムアクセストークンフック
--
-- profiles テーブルから role / facility_id / merchant_id を取得し、
-- JWT の app_metadata に埋め込む。
--
-- 設定方法（Supabase Dashboard）:
--   Authentication > Hooks > Custom Access Token Hook で
--   public.custom_access_token_hook を指定する。
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  app_meta jsonb;
  user_role text;
  user_facility_id text;
  user_merchant_id text;
BEGIN
  claims := event -> 'claims';

  -- profiles から取得
  SELECT
    role::TEXT,
    facility_id::TEXT,
    merchant_id::TEXT
  INTO user_role, user_facility_id, user_merchant_id
  FROM public.profiles
  WHERE id = (event ->> 'user_id')::UUID;

  -- 既存の app_metadata を取り出し、claims をマージ
  app_meta := COALESCE(claims -> 'app_metadata', '{}'::jsonb);

  IF user_role IS NOT NULL THEN
    app_meta := app_meta || jsonb_build_object('role', user_role);
  END IF;
  IF user_facility_id IS NOT NULL THEN
    app_meta := app_meta || jsonb_build_object('facility_id', user_facility_id);
  END IF;
  IF user_merchant_id IS NOT NULL THEN
    app_meta := app_meta || jsonb_build_object('merchant_id', user_merchant_id);
  END IF;

  claims := jsonb_set(claims, '{app_metadata}', app_meta);
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Auth Hook が呼び出すには supabase_auth_admin に EXECUTE 権限が必要
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.profiles TO supabase_auth_admin;
