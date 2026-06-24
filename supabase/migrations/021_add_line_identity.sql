-- ============================================================
-- 021_add_line_identity.sql
-- LINE 連携（家族向け本命認証 / LINE通知）のための識別子カラム追加
--
-- - profiles.line_user_id : LINE Login で得る一意なユーザーID（OIDC の sub）。
--     これをキーに Supabase auth ユーザーと LINE アカウントを 1:1 で紐付ける。
-- - resident_accounts.line_follow_state : 公式アカウントの友だち状態。
--     'unknown'（未確認）/ 'followed'（友だち）/ 'blocked'（ブロック）。
--     push 通知の可否判定に使う（ブロック中は LINE push を試行しない）。
--
-- セキュリティ: line_user_id は機微情報。閲覧は本人(self)と admin のみ（profiles の
--   既存 RLS をそのまま継承）。書き込みは service_role API（OAuth コールバック）経由のみ。
-- ============================================================

-- LINE ユーザーID（OIDC sub）。NULL = LINE 未連携
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS line_user_id TEXT;

-- 1つの LINE アカウントは1つの profile にのみ紐付く（NULL は対象外）
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_line_user_id
  ON public.profiles (line_user_id)
  WHERE line_user_id IS NOT NULL;

-- 公式アカウントの友だち状態（LINE push の前提）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'line_follow_state'
  ) THEN
    CREATE TYPE line_follow_state AS ENUM ('unknown', 'followed', 'blocked');
  END IF;
END
$$;

ALTER TABLE public.resident_accounts
  ADD COLUMN IF NOT EXISTS line_follow_state line_follow_state NOT NULL DEFAULT 'unknown';

COMMENT ON COLUMN public.profiles.line_user_id IS 'LINE Login OIDC sub。LINE アカウントとの 1:1 紐付けキー（機微情報）';
COMMENT ON COLUMN public.resident_accounts.line_follow_state IS 'LINE 公式アカウント友だち状態。push 可否判定に使用';
