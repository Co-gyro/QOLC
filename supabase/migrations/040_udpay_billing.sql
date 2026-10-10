-- ============================================================
-- 040: UD Payment 本番の請求・課金（段階C）
--
-- 前提: 037・039 適用済み。
-- 適用: Supabase ダッシュボードの SQL Editor に貼り付けて実行（何度実行しても同じ結果）。
-- ============================================================

-- 請求メールの件名・追記コメント（金額・明細・決済日の行は自動差し込み）、決済確定の取消日時
ALTER TABLE public.udpay_invoices
  ADD COLUMN IF NOT EXISTS mail_subject              VARCHAR(200),
  ADD COLUMN IF NOT EXISTS mail_comment              TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_cancelled_at TIMESTAMPTZ;

COMMENT ON COLUMN public.udpay_invoices.status IS
  'draft=下書き / submitted=課金予約（担当者・メール未送付） / approved=決済確定（承認者の一括実行・メール送付済み） / cancelled=取り下げ';

-- 課金の自動処理で拾う請求（決済確定かつ課金日到来）を速く引く
CREATE INDEX IF NOT EXISTS idx_udpay_payments_due_scheduled
  ON public.udpay_payments (scheduled_date)
  WHERE status = 'scheduled';
