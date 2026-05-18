-- ============================================================
-- 001_create_enums.sql
-- QOLC 全体で使用する ENUM 型を定義
-- ============================================================

-- ユーザーロール
CREATE TYPE user_role AS ENUM (
  'admin',           -- 運営者（UD社員）
  'facility_staff',  -- 介護施設スタッフ
  'provider',        -- サービス提供者（医療機関、薬局等）
  'family'           -- 入居者・家族
);

-- 決済ステータス
CREATE TYPE payment_status AS ENUM (
  'pending',     -- 保留（カード未登録等）
  'authorized',  -- 与信取得済み
  'captured',    -- 売上計上済み
  'failed',      -- 失敗
  'cancelled',   -- 取消
  'refunded'     -- 返金
);

-- アップロード処理ステータス
CREATE TYPE upload_status AS ENUM (
  'processing',  -- 処理中
  'preview',     -- プレビュー（確認待ち）
  'confirmed',   -- 確認済み（決済実行待ち）
  'completed',   -- 完了
  'error'        -- エラー
);

-- 入居者マッチング状態
CREATE TYPE match_status AS ENUM (
  'matched',     -- マッチ成功
  'unmatched',   -- 該当なし
  'ambiguous'    -- 複数候補あり
);

-- 加盟店申請ステータス
CREATE TYPE merchant_app_status AS ENUM (
  'pending',     -- 申請中
  'reviewing',   -- 審査中
  'approved',    -- 承認済み
  'rejected'     -- 却下
);

-- アカウント種別（入居者本人 / 家族）
CREATE TYPE account_type AS ENUM (
  'self',   -- 入居者本人
  'family'  -- 家族
);

-- 通知手段
CREATE TYPE notification_method AS ENUM (
  'line',    -- LINE
  'email',   -- メール
  'postal'   -- 郵送
);

-- 明細表示頻度
CREATE TYPE display_frequency AS ENUM (
  'monthly',   -- 月次
  'bimonthly'  -- 隔月
);
