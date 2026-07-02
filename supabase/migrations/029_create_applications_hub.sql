-- ============================================================
-- 029_create_applications_hub.sql
-- 申請/タスク 一元ハブ。
--   - 公開フォームの受け皿：QOLC加盟店申請(/apply) と JCB住み替え相談(/jcb)
--   - adminでタスク管理：担当者(assignee)・状態・優先度・期限・次アクション・変更履歴
-- 公開INSERTはAPI(service_role)経由でRLSをバイパスする。anon公開ポリシーは付与しない。
-- 冪等（再実行可）。CLI未リンクのため SQL Editor 手動適用が前提。
-- ============================================================

-- ---- 列挙型（存在すればスキップ） --------------------------------------------
DO $$ BEGIN
  CREATE TYPE application_source AS ENUM ('qolc_merchant', 'jcb_consult');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  -- new=新規 / in_progress=対応中 / waiting=相手待ち / done=完了 / rejected=却下
  CREATE TYPE application_status AS ENUM ('new', 'in_progress', 'waiting', 'done', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_priority AS ENUM ('low', 'normal', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---- 申請/タスク 本体 -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source          application_source   NOT NULL,
  status          application_status   NOT NULL DEFAULT 'new',
  priority        application_priority NOT NULL DEFAULT 'normal',
  -- 申請者/相談者（公開フォーム由来）
  applicant_name  TEXT,          -- ご担当者名 / ご相談者名
  applicant_org   TEXT,          -- 施設名 / 会社名
  applicant_email TEXT,
  applicant_phone TEXT,
  message         TEXT,          -- ご相談内容・自由記述
  payload         JSONB,         -- フォーム全項目（source別の可変項目を保持）
  -- タスク管理
  assignee_id     UUID REFERENCES auth.users(id),  -- 担当者（誰が）
  due_date        DATE,                             -- 期限
  next_action     TEXT,                             -- 次アクション（何を）
  -- 変換連携（承認後に加盟店へ紐付け）
  merchant_id     UUID REFERENCES public.merchants(id),
  -- 監査
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

DROP TRIGGER IF EXISTS trg_applications_updated_at ON public.applications;
CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_applications_status   ON public.applications (status)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_applications_assignee ON public.applications (assignee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_applications_source   ON public.applications (source)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_applications_created  ON public.applications (created_at DESC) WHERE deleted_at IS NULL;

-- ---- 変更履歴（タイムライン：誰がいつ何をしたか） --------------------------
CREATE TABLE IF NOT EXISTS public.application_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  actor_id       UUID REFERENCES auth.users(id),  -- NULL=公開申請者/システム
  kind           TEXT NOT NULL,   -- created / status_changed / assigned / priority_changed / next_action / commented
  detail         JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_application_events_app
  ON public.application_events (application_id, created_at);

-- ---- RLS（adminのみ。公開INSERTはservice_role経由） -------------------------
ALTER TABLE public.applications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_applications_admin_all ON public.applications;
CREATE POLICY p_applications_admin_all ON public.applications
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS p_application_events_admin_all ON public.application_events;
CREATE POLICY p_application_events_admin_all ON public.application_events
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
