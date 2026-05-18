-- ============================================================
-- 009_create_notification_tables.sql
-- 通知（LINE/メール/お知らせ）
-- ============================================================

CREATE TABLE public.notifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_account_id   UUID NOT NULL REFERENCES public.resident_accounts(id),
  type                  VARCHAR(50) NOT NULL,   -- 'payment_completed', 'card_expiring', 等
  title                 TEXT NOT NULL,
  body                  TEXT,
  sent_at               TIMESTAMPTZ,
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
