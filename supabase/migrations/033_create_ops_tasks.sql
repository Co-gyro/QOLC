-- ============================================================
-- 033: その他業務タスク（ops_tasks）
--
-- 画面機能がまだない業務（入金確認・チャージバック対応・カード会社への届出など）の
-- 記録場所。「その他業務」ページ（/admin/other-tasks）唯一の純タスク管理:
--   未着手(todo) → 対応中(in_progress) → 完了(done)（＋保留(on_hold)）
-- 定例タスクは /api/cron/daily がコード定義ルール（OPS_RECURRING_RULES）から
-- 月次で自動起票する。recurring_key + period の一意制約で多重起票を防ぐ。
-- 将来ここの定型業務に画面機能ができたら業務メニューへ昇格し、このリストから消す。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ops_tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'todo'
                 CHECK (status IN ('todo', 'in_progress', 'done', 'on_hold')),
  -- 任意の分類（入金管理 / 届出 / チャージバック など。画面のフィルタ用）
  category       TEXT,
  assignee_id    UUID REFERENCES auth.users(id),
  due_date       DATE,
  note           TEXT,
  -- 定例自動起票の識別（手動起票は両方 NULL）
  recurring_key  TEXT,
  period         TEXT,  -- 対象期間（例: '2026-07'）
  completed_at   TIMESTAMPTZ,
  completed_by   UUID REFERENCES auth.users(id),
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ
);

-- 定例起票の多重防止（同じルール×同じ期間は1件のみ）
CREATE UNIQUE INDEX IF NOT EXISTS uq_ops_tasks_recurring
  ON public.ops_tasks (recurring_key, period)
  WHERE recurring_key IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ops_tasks_status ON public.ops_tasks (status);
CREATE INDEX IF NOT EXISTS idx_ops_tasks_due ON public.ops_tasks (due_date);

DROP TRIGGER IF EXISTS trg_ops_tasks_updated_at ON public.ops_tasks;
CREATE TRIGGER trg_ops_tasks_updated_at
  BEFORE UPDATE ON public.ops_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ops_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_ops_tasks_admin_all ON public.ops_tasks;
CREATE POLICY p_ops_tasks_admin_all ON public.ops_tasks
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
