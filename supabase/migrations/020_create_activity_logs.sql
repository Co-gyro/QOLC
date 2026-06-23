-- ============================================================
-- 020_create_activity_logs.sql
-- 汎用 操作ログ（決済以外の運用操作も記録する監査ログ）
-- 決済は payment_audit_logs、運用操作は本テーブル。閲覧は /api/logs で統合。
-- 改ざん防止: INSERT は service_role 経由のみ、UPDATE/DELETE 不可。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID REFERENCES auth.users(id),
  actor_role    VARCHAR(20),
  actor_name    TEXT,                                   -- 表示名スナップショット
  facility_id   UUID REFERENCES public.facilities(id),  -- 施設スコープ（NULL=運営操作等）
  action        VARCHAR(50) NOT NULL,                   -- 例: resident_create, invite_create, upload, merchant_create
  target_type   VARCHAR(30),                            -- resident / account / merchant / upload ...
  target_id     UUID,
  target_label  TEXT,                                   -- 表示用ラベル（入居者名・加盟店名など）
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_facility ON public.activity_logs (facility_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs (action);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- 読み取り: admin は全件、facility_staff は自施設のみ
CREATE POLICY p_activity_logs_admin_read ON public.activity_logs
  FOR SELECT USING (public.is_admin());
CREATE POLICY p_activity_logs_facility_read ON public.activity_logs
  FOR SELECT USING (
    public.jwt_role() = 'facility_staff'
    AND facility_id IS NOT NULL
    AND facility_id = public.jwt_facility_id()
  );

-- INSERT/UPDATE/DELETE ポリシーは作成しない（authenticated/anon は不可）。
-- 記録は API Route が service_role キーで行い RLS をバイパスする。
-- 改ざん防止のため UPDATE/DELETE 権限を全 role から剥奪。
REVOKE UPDATE, DELETE ON public.activity_logs FROM anon, authenticated;
