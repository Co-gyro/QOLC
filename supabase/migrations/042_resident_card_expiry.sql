-- ============================================================
-- 042: QOLC 家族のカードの有効期限（段階D-2: カード有効期限の案内）
--
-- resident_accounts（支払いオーナーのアカウント）に、登録カードのブランド・下4桁・有効期限を持たせる。
-- 値は USEN の会員情報取得（/member/get）から取得する。カード番号は保持しない。
-- 適用: Supabase ダッシュボードの SQL Editor に貼り付けて実行（何度実行しても同じ結果。DROP なし）。
-- ============================================================

ALTER TABLE public.resident_accounts
  ADD COLUMN IF NOT EXISTS card_brand      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS card_last4      CHAR(4),
  ADD COLUMN IF NOT EXISTS card_expire_ym  CHAR(6)
    CHECK (card_expire_ym IS NULL OR card_expire_ym ~ '^[0-9]{4}(0[1-9]|1[0-2])$'),
  ADD COLUMN IF NOT EXISTS card_checked_at TIMESTAMPTZ;

COMMENT ON COLUMN public.resident_accounts.card_expire_ym IS
  '登録カードの有効期限 YYYYMM（USEN /member/get）。期限月の前月1日と期限月1日に LINE で更新を案内する';
