-- ============================================================
-- 037_create_udpay_tables.sql
-- UD Payment 本番テーブル（ランサイド様ほか、介護以外の月次請求＋登録カード継続課金）
--
-- デモ（udpay_demo_store の1行JSONB）とは別物。本番は正規化したテーブルで持つ。
-- 既存 payments は resident_id NOT NULL で介護ドメイン専用のため、036 と同じく独立テーブルにする。
--
-- 業務の流れ:
--   顧客登録 → カード登録リンク（registration_token）→ USEN 会員ID（usen_member_id）確定
--   → 請求作成（draft）→ 提出（submitted）→ 承認者が承認（approved）
--   → 決済予定日に課金（udpay_payments: scheduled → captured / failed）
-- 作成者と承認者を分ける（2026-09-29 ランサイド様打ち合わせ）。
-- 請求合計が 0 円以下の請求は提出・承認できない（マイナス明細は可・合計マイナス不可）。
--
-- 読み書きは service_role の API が主。RLS は多層防御として、
-- 管理者は全件・UD Payment 利用者は自社（merchant_id）分のみ許可する。
-- 適用は Supabase ダッシュボード SQL Editor で手動（CLI 未リンクのため）。
-- ============================================================

-- UD Payment 利用企業のユーザー（ランサイド様の担当者・承認者）
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'udpay_merchant';

CREATE TYPE udpay_invoice_status AS ENUM (
  'draft',      -- 作成中（担当者が編集できる）
  'submitted',  -- 提出済み（承認待ち・編集不可）
  'approved',   -- 承認済み（課金予約あり）
  'cancelled'   -- 取り下げ
);

CREATE TYPE udpay_payment_status AS ENUM (
  'scheduled',  -- 課金予約（決済予定日待ち）
  'processing', -- 課金処理中（二重実行防止のロック）
  'captured',   -- 売上確定
  'failed',     -- 与信落ち（再試行待ち or 要対応）
  'cancelled',  -- 取消（締め前）
  'refunded'    -- 返品（締め後）
);

CREATE TYPE udpay_mail_kind AS ENUM (
  'card_registration', -- カード登録のご案内
  'invoice',           -- 請求明細
  'receipt',           -- 領収書
  'payment_failed',    -- 与信落ちのお知らせ
  'approval_request'   -- 承認依頼（承認者あて）
);

-- ============================================================
-- UD Payment 利用者（ログインユーザーと利用企業の紐付け・承認権限）
-- ============================================================
CREATE TABLE public.udpay_members (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id),
  merchant_id   UUID NOT NULL REFERENCES public.merchants(id),
  display_name  VARCHAR(50) NOT NULL,
  -- 承認者（課金Go）。自分が作成・提出した請求は承認できない（アプリ側で制御）
  is_approver   BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_udpay_members_merchant ON public.udpay_members (merchant_id);
CREATE TRIGGER trg_udpay_members_updated_at
  BEFORE UPDATE ON public.udpay_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 請求先顧客（ランサイド様の顧客＝歯科医院など）
-- ============================================================
CREATE TABLE public.udpay_customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         UUID NOT NULL REFERENCES public.merchants(id),
  name                VARCHAR(100) NOT NULL,
  contact_name        VARCHAR(50),
  -- 請求書に印字する備考（顧客既定）と、印字しない社内メモ
  billing_note        TEXT,
  internal_memo       TEXT,
  -- 顧客別の決済日（1〜28）。NULL は請求バッチの決済予定日に従う
  charge_day          SMALLINT CHECK (charge_day BETWEEN 1 AND 28),
  -- カード登録リンク用トークン（URLに載る推測困難な値）
  registration_token  VARCHAR(64) NOT NULL UNIQUE,
  -- USEN 会員ID（カード登録完了で確定。カード番号は一切保持しない）
  usen_member_id      VARCHAR(40) UNIQUE,
  card_brand          VARCHAR(20),
  card_registered_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_udpay_customers_merchant ON public.udpay_customers (merchant_id);
CREATE TRIGGER trg_udpay_customers_updated_at
  BEFORE UPDATE ON public.udpay_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 顧客のメール宛先（To/CC を複数・氏名つき）
CREATE TABLE public.udpay_customer_contacts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES public.udpay_customers(id),
  kind         VARCHAR(2) NOT NULL CHECK (kind IN ('to', 'cc')),
  name         VARCHAR(50),
  email        VARCHAR(254) NOT NULL,
  sort         SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_udpay_customer_contacts_customer ON public.udpay_customer_contacts (customer_id);
CREATE TRIGGER trg_udpay_customer_contacts_updated_at
  BEFORE UPDATE ON public.udpay_customer_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 月次請求書
-- ============================================================
CREATE TABLE public.udpay_invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id            UUID NOT NULL REFERENCES public.merchants(id),
  customer_id            UUID NOT NULL REFERENCES public.udpay_customers(id),
  -- サービス提供月（YYYY-MM）
  service_month          CHAR(7) NOT NULL CHECK (service_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status                 udpay_invoice_status NOT NULL DEFAULT 'draft',
  billing_note           TEXT,
  -- 金額は提出時に明細から確定して保存する（税抜小計・消費税・税込合計）
  subtotal               BIGINT NOT NULL DEFAULT 0,
  tax                    BIGINT NOT NULL DEFAULT 0,
  total                  BIGINT NOT NULL DEFAULT 0,
  -- 決済予定日（請求バッチ単位で指定。既定は毎月25日）
  scheduled_charge_date  DATE,
  created_by             UUID REFERENCES auth.users(id),
  submitted_by           UUID REFERENCES auth.users(id),
  submitted_at           TIMESTAMPTZ,
  approved_by            UUID REFERENCES auth.users(id),
  approved_at            TIMESTAMPTZ,
  cancelled_at           TIMESTAMPTZ,
  mail_sent_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at             TIMESTAMPTZ,
  -- 提出以降は合計が正でなければならない（トータルマイナス・0円請求の防止）
  CONSTRAINT chk_udpay_invoices_total_positive
    CHECK (status IN ('draft', 'cancelled') OR total > 0),
  -- 作成者と承認者は別人（誤課金防止の職務分離）
  CONSTRAINT chk_udpay_invoices_approver_differs
    CHECK (approved_by IS NULL OR submitted_by IS NULL OR approved_by <> submitted_by)
);
-- 同一顧客・同一月の有効な請求は1件まで
CREATE UNIQUE INDEX uq_udpay_invoices_customer_month
  ON public.udpay_invoices (customer_id, service_month)
  WHERE deleted_at IS NULL AND status <> 'cancelled';
CREATE INDEX idx_udpay_invoices_merchant_month ON public.udpay_invoices (merchant_id, service_month);
CREATE TRIGGER trg_udpay_invoices_updated_at
  BEFORE UPDATE ON public.udpay_invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 請求明細（単価は税抜。値引き等のマイナス単価を許可）
CREATE TABLE public.udpay_invoice_lines (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id   UUID NOT NULL REFERENCES public.udpay_invoices(id),
  sort         SMALLINT NOT NULL DEFAULT 0,
  description  VARCHAR(100) NOT NULL,
  quantity     INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 999),
  unit_price   BIGINT NOT NULL CHECK (unit_price BETWEEN -10000000 AND 10000000),
  tax_rate     SMALLINT NOT NULL DEFAULT 10 CHECK (tax_rate IN (0, 8, 10)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);
CREATE INDEX idx_udpay_invoice_lines_invoice ON public.udpay_invoice_lines (invoice_id);
CREATE TRIGGER trg_udpay_invoice_lines_updated_at
  BEFORE UPDATE ON public.udpay_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 課金（1請求＝1課金。再試行は同じ行で attempt_count を進める）
-- ============================================================
CREATE TABLE public.udpay_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         UUID NOT NULL REFERENCES public.merchants(id),
  invoice_id          UUID NOT NULL UNIQUE REFERENCES public.udpay_invoices(id),
  customer_id         UUID NOT NULL REFERENCES public.udpay_customers(id),
  amount              BIGINT NOT NULL CHECK (amount > 0),
  scheduled_date      DATE NOT NULL,
  status              udpay_payment_status NOT NULL DEFAULT 'scheduled',
  -- USEN 受注番号（[mall_cd]-[7桁]。試行ごとに採番し直すため最新値を保持）
  usen_jutyu_cd       VARCHAR(40) UNIQUE,
  attempt_count       SMALLINT NOT NULL DEFAULT 0,
  -- 自動再試行の予定日（NULL は再試行なし＝要対応）
  next_retry_on       DATE,
  last_error_code     VARCHAR(40),
  last_error_message  TEXT,
  authorized_at       TIMESTAMPTZ,
  captured_at         TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  refunded_at         TIMESTAMPTZ,
  receipt_sent_at     TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_udpay_payments_due ON public.udpay_payments (status, scheduled_date);
CREATE INDEX idx_udpay_payments_merchant ON public.udpay_payments (merchant_id);
CREATE TRIGGER trg_udpay_payments_updated_at
  BEFORE UPDATE ON public.udpay_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- メール送付履歴（請求明細・領収書・カード登録案内などの送付記録）
-- ============================================================
CREATE TABLE public.udpay_mail_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  UUID NOT NULL REFERENCES public.merchants(id),
  kind         udpay_mail_kind NOT NULL,
  customer_id  UUID REFERENCES public.udpay_customers(id),
  invoice_id   UUID REFERENCES public.udpay_invoices(id),
  payment_id   UUID REFERENCES public.udpay_payments(id),
  to_addrs     TEXT[] NOT NULL DEFAULT '{}',
  cc_addrs     TEXT[] NOT NULL DEFAULT '{}',
  subject      TEXT NOT NULL,
  -- sent=送信成功 / skipped=メール未設定で送らなかった / failed=送信失敗
  status       VARCHAR(10) NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
  provider_id  VARCHAR(100),
  error        TEXT,
  sent_by      UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_udpay_mail_logs_invoice ON public.udpay_mail_logs (invoice_id);
CREATE INDEX idx_udpay_mail_logs_payment ON public.udpay_mail_logs (payment_id);
CREATE TRIGGER trg_udpay_mail_logs_updated_at
  BEFORE UPDATE ON public.udpay_mail_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- RLS（管理者は全件・UD Payment 利用者は自社分のみ）
-- ============================================================

-- ログインユーザーの所属企業（UD Payment 利用者でなければ NULL）。
-- SECURITY DEFINER で RLS の再帰を避ける（015 の is_admin と同方式）
CREATE OR REPLACE FUNCTION public.udpay_my_merchant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT merchant_id FROM public.udpay_members
  WHERE user_id = auth.uid() AND deleted_at IS NULL
  LIMIT 1
$$;

ALTER TABLE public.udpay_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udpay_customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udpay_customer_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udpay_invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udpay_invoice_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udpay_payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.udpay_mail_logs         ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_udpay_members_rw ON public.udpay_members
  FOR ALL USING (public.is_admin() OR merchant_id = public.udpay_my_merchant_id())
  WITH CHECK (public.is_admin());

CREATE POLICY p_udpay_customers_rw ON public.udpay_customers
  FOR ALL USING (public.is_admin() OR merchant_id = public.udpay_my_merchant_id())
  WITH CHECK (public.is_admin() OR merchant_id = public.udpay_my_merchant_id());

CREATE POLICY p_udpay_customer_contacts_rw ON public.udpay_customer_contacts
  FOR ALL USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.udpay_customers c
      WHERE c.id = customer_id AND c.merchant_id = public.udpay_my_merchant_id()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.udpay_customers c
      WHERE c.id = customer_id AND c.merchant_id = public.udpay_my_merchant_id()
    )
  );

CREATE POLICY p_udpay_invoices_rw ON public.udpay_invoices
  FOR ALL USING (public.is_admin() OR merchant_id = public.udpay_my_merchant_id())
  WITH CHECK (public.is_admin() OR merchant_id = public.udpay_my_merchant_id());

CREATE POLICY p_udpay_invoice_lines_rw ON public.udpay_invoice_lines
  FOR ALL USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.udpay_invoices i
      WHERE i.id = invoice_id AND i.merchant_id = public.udpay_my_merchant_id()
    )
  )
  WITH CHECK (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.udpay_invoices i
      WHERE i.id = invoice_id AND i.merchant_id = public.udpay_my_merchant_id()
    )
  );

-- 課金とメール履歴は利用者から参照のみ（書き込みは service_role のサーバー処理だけ）
CREATE POLICY p_udpay_payments_read ON public.udpay_payments
  FOR SELECT USING (public.is_admin() OR merchant_id = public.udpay_my_merchant_id());

CREATE POLICY p_udpay_mail_logs_read ON public.udpay_mail_logs
  FOR SELECT USING (public.is_admin() OR merchant_id = public.udpay_my_merchant_id());
