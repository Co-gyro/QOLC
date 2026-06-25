-- ============================================================
-- 023_create_statement_service_details.sql
-- 明細書(B案)用: 介護レセプト区分02のサービス明細を保持する。
-- statement_line(利用者×月の集計行)に紐づくサービスコード別の単位数・回数。
-- レセプトには日付・時間が無いため、サービスコード単位の集約（B案）。
-- ============================================================
CREATE TABLE public.statement_service_details (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_line_id  UUID NOT NULL REFERENCES public.statement_lines(id) ON DELETE CASCADE,
  service_type_code  VARCHAR(4),     -- サービス種類コード(2桁)
  service_item_code  VARCHAR(8),     -- サービス項目コード(4桁)
  unit_score         INTEGER NOT NULL DEFAULT 0,  -- 単位数(単価)
  count              INTEGER NOT NULL DEFAULT 0,  -- 回数・日数
  total_units        INTEGER NOT NULL DEFAULT 0,  -- 合計単位数(負値=減算あり)
  sort_order         INTEGER NOT NULL DEFAULT 0,  -- レセプト記載順
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ssd_statement_line
  ON public.statement_service_details (statement_line_id);

ALTER TABLE public.statement_service_details ENABLE ROW LEVEL SECURITY;

-- 直接のクライアント参照は無し（領収書生成は service_role の admin client が取得し、
-- ルート側でロール別認可を行う）。service_role は RLS をバイパスする。
-- 管理者ユーザーには参照を許可（運用調査用）。
DROP POLICY IF EXISTS p_ssd_admin_all ON public.statement_service_details;
CREATE POLICY p_ssd_admin_all ON public.statement_service_details
  FOR ALL
  USING (public.jwt_role() = 'admin')
  WITH CHECK (public.jwt_role() = 'admin');

COMMENT ON TABLE public.statement_service_details
  IS '介護レセプト区分02のサービス明細(B案明細書用)。statement_line に紐づく。日付/時間はレセプトに無い';
