-- ============================================================
-- 013_seed_mall_codes.sql
-- モールコードプール（A300〜A3ZZ、1,296件）
-- 端末識別番号プール（3124620001000〜3124620001999、1,000件）
-- ============================================================

-- ============================================================
-- モールコード A300〜A3ZZ を生成
-- 3桁目・4桁目は 0-9, A-Z（計36文字）の組み合わせ
-- 例: A300, A301, ..., A309, A30A, A30B, ..., A30Z, A310, ..., A3ZZ
-- ============================================================
DO $$
DECLARE
  chars CONSTANT TEXT := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  c3 INT;
  c4 INT;
  v_code VARCHAR(4);
BEGIN
  FOR c3 IN 1..length(chars) LOOP
    FOR c4 IN 1..length(chars) LOOP
      v_code := 'A3' || substring(chars FROM c3 FOR 1) || substring(chars FROM c4 FOR 1);
      INSERT INTO public.mall_code_pool (code, status)
      VALUES (v_code, 'available')
      ON CONFLICT (code) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- 端末識別番号 3124620001000〜3124620001999（1,000件）
-- ============================================================
INSERT INTO public.terminal_id_pool (terminal_id, status)
SELECT
  '312462000' || LPAD(n::TEXT, 4, '0'),
  'available'
FROM generate_series(1000, 1999) AS s(n)
ON CONFLICT (terminal_id) DO NOTHING;
