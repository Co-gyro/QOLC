-- ============================================================
-- 031_extend_applications_hub.sql
-- 申請/タスク一元ハブの拡張（業務OS化 Step1+Step2）。
--   1) application_source に一般問い合わせ・サポート系を追加
--   2) application_events.kind の許容値を追加（TEXT 列のため DDL 変更は不要。
--      029 と同様、許容値はコメントで管理し、アプリ側は
--      src/lib/applications/labels.ts の ApplicationEventKind と同期する）
--   3) applications.ud_input 追加（UD追記情報。顧客入力 payload と分離）
-- 冪等（再実行可）。CLI未リンクのため SQL Editor 手動適用が前提。
-- ============================================================

-- ---- 1) application_source の拡張 --------------------------------------------
-- contact=一般お問い合わせ / support_facility=施設サポート /
-- support_family=ご家族サポート / support_provider=提供者サポート
ALTER TYPE application_source ADD VALUE IF NOT EXISTS 'contact';
ALTER TYPE application_source ADD VALUE IF NOT EXISTS 'support_facility';
ALTER TYPE application_source ADD VALUE IF NOT EXISTS 'support_family';
ALTER TYPE application_source ADD VALUE IF NOT EXISTS 'support_provider';

-- ---- 2) application_events.kind の許容値追加 ----------------------------------
-- kind は TEXT（029 でコメント管理方式）。既存:
--   created / status_changed / assigned / priority_changed / due_changed /
--   next_action / commented
-- 追加:
--   comment          = 対応メモ（対応履歴として残す自由記述）
--   email_sent       = メール送信（送信結果 payload を detail に保存）
--   converted        = 加盟店へ変換（承認後に merchants へ紐付けた記録）
--   ud_input_updated = UD追記情報の更新（before/after 付き）
--   review_registered= 審査結果の登録（JCB/セゾン別・before/after 付き）
--   workflow_started = 申請工程（workflow_runs）の起票
COMMENT ON COLUMN public.application_events.kind IS
  'created / status_changed / assigned / priority_changed / due_changed / next_action / commented / comment / email_sent / converted / ud_input_updated / review_registered / workflow_started';

-- ---- 3) applications.ud_input 追加 --------------------------------------------
-- UD側の追記情報（業態コード・POS支店コード等）。顧客入力の payload とは
-- 分離して保持し、顧客の入力値を上書きしない。
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS ud_input JSONB;

COMMENT ON COLUMN public.applications.ud_input IS
  'UD追記情報（業態コード等）。顧客入力の payload と分離して保持する';
