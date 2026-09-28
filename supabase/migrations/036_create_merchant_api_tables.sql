-- ============================================================
-- 036_create_merchant_api_tables.sql
-- 加盟店向け決済API（AINY LIVE ほか、自社サイトを持つ子加盟店むけ）
--
-- 既存の payments は resident_id NOT NULL で介護ドメイン専用のため、
-- チケット等の「入居者を伴わない」決済は本テーブル群で受ける。
-- 接続仕様書 v1.0（2026-09-08 DD様提供分）に対応する。
--
-- 決済画面は当社がホストする（/checkout/{session_id}）。USEN とは
-- トークン式EC決済API（ec-payment-uhup・/i/token/init → 3DS → /i/pay）で接続し、
-- option=capture で即時売上とする。結果は取引照会（/search/trade）で確定させる。
-- test 環境は USEN のテストモール（実課金なし）、production は merchants.mall_code。
-- ============================================================

-- 接続環境（テスト／本番）
CREATE TYPE merchant_api_env AS ENUM ('test', 'production');

-- 決済の状態（接続仕様書 第4章の状態遷移に対応）
CREATE TYPE merchant_payment_status AS ENUM (
  'created',    -- セッション作成直後（購入者は決済画面へ未遷移）
  'pending',    -- 決済画面で処理中
  'succeeded',  -- 決済完了・売上計上済み
  'failed',     -- カード会社が非承認
  'cancelled',  -- 購入者が決済画面で中断
  'expired',    -- expires_at 経過
  'refunded'    -- 返金済み
);

-- ============================================================
-- 加盟店API の資格情報
-- 署名鍵は AES-256-GCM で暗号化して保持する（鍵は env: MERCHANT_API_SECRET_ENC_KEY）
-- ============================================================
CREATE TABLE public.merchant_api_credentials (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id              UUID NOT NULL REFERENCES public.merchants(id),
  environment              merchant_api_env NOT NULL,
  -- 加盟店へ渡す識別子（X-UD-Merchant-Id）
  api_merchant_id          VARCHAR(40) NOT NULL,
  -- 署名鍵の暗号文 "v1:<iv b64>:<tag b64>:<ciphertext b64>"
  secret_enc               TEXT NOT NULL,
  -- 照合用の末尾4文字（平文の一部・鍵の復元には使えない）
  secret_last4             VARCHAR(4) NOT NULL,
  -- 鍵の再発行後も旧鍵を一定時間受け付ける（接続仕様書 第3章: 再発行から24時間）
  previous_secret_enc      TEXT,
  previous_secret_expires_at TIMESTAMPTZ,
  -- 戻り先・通知先として許可するドメイン（ホスト名のみ・小文字）
  allowed_domains          TEXT[] NOT NULL DEFAULT '{}',
  -- 決済結果通知の送信先
  webhook_url              TEXT,
  -- 販売可能期間（公演日が本日から何か月先まで許容されるか）
  max_event_months         SMALLINT NOT NULL DEFAULT 3,
  -- 決済金額の上限（1件あたり・円）。NULL は無制限
  amount_limit_per_payment BIGINT,
  -- セッション有効期間の上限（秒）
  max_expires_in           INTEGER NOT NULL DEFAULT 3600,
  -- 取引停止（merchant_suspended 403）。鍵は有効なまま新規セッションだけを止める
  suspended_at             TIMESTAMPTZ,
  -- 鍵の失効（signature_invalid 401 と同じ扱い）
  revoked_at               TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at               TIMESTAMPTZ,
  CONSTRAINT chk_mac_max_event_months CHECK (max_event_months BETWEEN 1 AND 12),
  CONSTRAINT chk_mac_max_expires_in CHECK (max_expires_in BETWEEN 300 AND 5184000)
);

CREATE TRIGGER trg_merchant_api_credentials_updated_at
  BEFORE UPDATE ON public.merchant_api_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- api_merchant_id は全体で一意（失効済み・削除済みを除く）
CREATE UNIQUE INDEX idx_merchant_api_credentials_api_id
  ON public.merchant_api_credentials (api_merchant_id)
  WHERE deleted_at IS NULL;

-- 1加盟店につき環境ごと1件（再発行時は旧行を revoked_at + deleted_at で退避）
CREATE UNIQUE INDEX idx_merchant_api_credentials_merchant_env
  ON public.merchant_api_credentials (merchant_id, environment)
  WHERE deleted_at IS NULL AND revoked_at IS NULL;

-- ============================================================
-- 加盟店API の決済（セッション＝決済の1レコード）
-- ============================================================
CREATE TABLE public.merchant_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       UUID NOT NULL REFERENCES public.merchants(id),
  credential_id     UUID NOT NULL REFERENCES public.merchant_api_credentials(id),
  environment       merchant_api_env NOT NULL,

  -- 加盟店側の注文ID（冪等キー）
  order_id          VARCHAR(64) NOT NULL,
  -- 当社が採番して加盟店へ返す識別子
  payment_id        VARCHAR(40) NOT NULL,
  session_id        VARCHAR(40) NOT NULL,

  status            merchant_payment_status NOT NULL DEFAULT 'created',
  amount            BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL DEFAULT 'JPY',

  -- 公演（精算の判定に使う）
  event_id          VARCHAR(64) NOT NULL,
  event_name        VARCHAR(120) NOT NULL,
  event_date        DATE NOT NULL,
  -- 公演の実施確認（NULL=未確認／中止時は event_cancelled_at を立てる）
  event_settled_at  TIMESTAMPTZ,
  event_cancelled_at TIMESTAMPTZ,

  items             JSONB NOT NULL,
  customer_email    TEXT NOT NULL,
  return_url        TEXT NOT NULL,
  cancel_url        TEXT,

  -- USEN 側の受注コード（[モールコード]-[7桁]。セッション作成時に採番）
  usen_jutyu_cd     VARCHAR(20),
  -- /i/token/init を開始した時刻（1セッション1回の試行に限定するためのロック）
  usen_attempted_at TIMESTAMPTZ,
  -- /i/pay（オーソリ＋即時売上）を要求した時刻。以後は購入者の中断を受け付けない
  usen_pay_requested_at TIMESTAMPTZ,
  -- 取引照会で最後に確認した USEN の取引状態（sales / auth / unprocessed 等）
  usen_status       VARCHAR(30),
  usen_synced_at    TIMESTAMPTZ,
  card_brand        VARCHAR(20),
  card_last4        VARCHAR(4),

  expires_at        TIMESTAMPTZ NOT NULL,
  captured_at       TIMESTAMPTZ,
  refunded_at       TIMESTAMPTZ,
  -- 終了状態（failed / cancelled / expired）に達した時刻
  closed_at         TIMESTAMPTZ,
  failure_code      VARCHAR(50),
  failure_message   TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,

  -- USEN の sum_price は数字最大7桁
  CONSTRAINT chk_merchant_payments_amount CHECK (amount > 0 AND amount <= 9999999)
);

CREATE TRIGGER trg_merchant_payments_updated_at
  BEFORE UPDATE ON public.merchant_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 冪等キー: 同一加盟店・同一環境で同じ注文IDは1件のみ
CREATE UNIQUE INDEX idx_merchant_payments_order
  ON public.merchant_payments (merchant_id, environment, order_id);
CREATE UNIQUE INDEX idx_merchant_payments_payment_id
  ON public.merchant_payments (payment_id);
CREATE UNIQUE INDEX idx_merchant_payments_session_id
  ON public.merchant_payments (session_id);
-- 二重決済防止（USEN 側の受注コード）
CREATE UNIQUE INDEX idx_merchant_payments_jutyu_cd
  ON public.merchant_payments (usen_jutyu_cd)
  WHERE usen_jutyu_cd IS NOT NULL;

-- 取引一覧（日次照合）と未提供残高の集計で使う
CREATE INDEX idx_merchant_payments_merchant_created
  ON public.merchant_payments (merchant_id, created_at DESC);
CREATE INDEX idx_merchant_payments_event
  ON public.merchant_payments (merchant_id, event_id);
-- 期限切れ判定の対象（未完了のセッション）
CREATE INDEX idx_merchant_payments_open
  ON public.merchant_payments (expires_at)
  WHERE status IN ('created', 'pending');
-- 公演の実施待ち（入金保留分）の抽出用
CREATE INDEX idx_merchant_payments_pending_settlement
  ON public.merchant_payments (merchant_id, event_date)
  WHERE status = 'succeeded' AND event_settled_at IS NULL;

-- ============================================================
-- 決済結果通知の配送記録（再送の管理）
-- ============================================================
CREATE TABLE public.merchant_webhook_deliveries (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_payment_id UUID NOT NULL REFERENCES public.merchant_payments(id),
  event_type          VARCHAR(40) NOT NULL,   -- payment.succeeded 等
  -- 通知本文の occurred_at（再送しても同じ値を送る）
  occurred_at         TIMESTAMPTZ NOT NULL,
  url                 TEXT NOT NULL,
  attempt             SMALLINT NOT NULL DEFAULT 0,
  status_code         SMALLINT,
  error_message       TEXT,
  delivered_at        TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

CREATE TRIGGER trg_merchant_webhook_deliveries_updated_at
  BEFORE UPDATE ON public.merchant_webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 同一決済・同一種別の通知は1本（再送は attempt を進める）
CREATE UNIQUE INDEX idx_merchant_webhook_deliveries_unique
  ON public.merchant_webhook_deliveries (merchant_payment_id, event_type);
-- 再送バッチの抽出用
CREATE INDEX idx_merchant_webhook_deliveries_retry
  ON public.merchant_webhook_deliveries (next_retry_at)
  WHERE delivered_at IS NULL;

-- ============================================================
-- RLS（管理画面から読むのは admin のみ。API は service_role で動く）
-- ============================================================
ALTER TABLE public.merchant_api_credentials   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- 資格情報は admin でも SELECT のみ（暗号文の持ち出しを最小化）
CREATE POLICY p_merchant_api_credentials_admin_read ON public.merchant_api_credentials
  FOR SELECT USING (public.is_admin());

CREATE POLICY p_merchant_payments_admin_read ON public.merchant_payments
  FOR SELECT USING (public.is_admin());

CREATE POLICY p_merchant_webhook_deliveries_admin_read ON public.merchant_webhook_deliveries
  FOR SELECT USING (public.is_admin());
