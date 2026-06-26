-- ============================================================
-- 024_add_amount_to_statement_service_details.sql
-- 医療UKE(訪問看護療養費)の算定項目明細は円建てのため、項目別の費用(円)を保持する。
-- 介護(区分02)は単位数ベースのため amount は 0 のまま（unit_score/total_units を使用）。
-- ============================================================
ALTER TABLE public.statement_service_details
  ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.statement_service_details.amount
  IS '項目別費用(円)。医療UKEのKA金額合計。介護(区分02)は0(単位数を使用)';
