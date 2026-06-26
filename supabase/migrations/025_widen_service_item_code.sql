-- ============================================================
-- 025_widen_service_item_code.sql
-- statement_service_details.service_item_code を拡幅。
-- 介護(区分02)の項目コードは4桁だが、医療(訪問看護療養費)コードは9桁のため
-- VARCHAR(8) では収まらない。余裕をもって VARCHAR(16) に拡張する。
-- ============================================================
ALTER TABLE public.statement_service_details
  ALTER COLUMN service_item_code TYPE VARCHAR(16);
