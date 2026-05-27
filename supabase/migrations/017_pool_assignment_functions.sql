-- ============================================================
-- 017_pool_assignment_functions.sql
-- モールコード / 端末識別番号 をプールから原子的に払い出す関数
--
-- FOR UPDATE SKIP LOCKED で同時実行時の二重払い出しを防止。
-- SECURITY DEFINER + service_role のみに EXECUTE を付与し、
-- API Route（admin認証後）からのみ呼ばれる想定。
-- ============================================================

-- モールコードを1件払い出して merchant に設定し、コードを返す
CREATE OR REPLACE FUNCTION public.assign_mall_code(p_merchant_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_code VARCHAR;
BEGIN
  SELECT code INTO v_code
  FROM public.mall_code_pool
  WHERE status = 'available'
  ORDER BY code
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'モールコードプールが枯渇しています';
  END IF;

  UPDATE public.mall_code_pool
  SET status = 'assigned', assigned_to_merchant_id = p_merchant_id, assigned_at = now()
  WHERE code = v_code;

  UPDATE public.merchants SET mall_code = v_code WHERE id = p_merchant_id;
  RETURN v_code;
END;
$$;

-- 端末識別番号を1件払い出して merchant に設定し、番号を返す
CREATE OR REPLACE FUNCTION public.assign_terminal_id(p_merchant_id UUID)
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tid VARCHAR;
BEGIN
  SELECT terminal_id INTO v_tid
  FROM public.terminal_id_pool
  WHERE status = 'available'
  ORDER BY terminal_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_tid IS NULL THEN
    RAISE EXCEPTION '端末識別番号プールが枯渇しています';
  END IF;

  UPDATE public.terminal_id_pool
  SET status = 'assigned', assigned_to_merchant_id = p_merchant_id, assigned_at = now()
  WHERE terminal_id = v_tid;

  UPDATE public.merchants SET terminal_id = v_tid WHERE id = p_merchant_id;
  RETURN v_tid;
END;
$$;

-- プール残数を返すヘルパー（マスタ画面の残数表示用）
CREATE OR REPLACE FUNCTION public.pool_availability()
RETURNS TABLE(pool TEXT, available BIGINT, assigned BIGINT, total BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 'mall_code' AS pool,
    count(*) FILTER (WHERE status='available'),
    count(*) FILTER (WHERE status='assigned'),
    count(*)
  FROM public.mall_code_pool
  UNION ALL
  SELECT 'terminal_id',
    count(*) FILTER (WHERE status='available'),
    count(*) FILTER (WHERE status='assigned'),
    count(*)
  FROM public.terminal_id_pool;
$$;

-- EXECUTE は service_role のみ（API Routeが admin 認証後に呼ぶ）。
-- authenticated には付与しない（任意ユーザーが rpc 直叩きで払い出すのを防ぐ）。
REVOKE ALL ON FUNCTION public.assign_mall_code(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_terminal_id(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_mall_code(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_terminal_id(UUID) TO service_role;
-- 残数照会は admin（authenticated経由でRLS判定する画面）からも参照したいので service_role + authenticated
GRANT EXECUTE ON FUNCTION public.pool_availability() TO service_role, authenticated;
