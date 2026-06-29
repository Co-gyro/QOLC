-- ============================================================
-- 026_add_other_cost_to_statement_lines.sql
-- 介護保険「その他費用」(保険外＝家賃/食事/居住費/日常生活費等) を
-- レセプト本人負担と同一バッチに合算するための列を追加する。
--   - cost_kind:    'insurance'(保険分・既定) / 'other'(その他費用＝保険外)
--   - tax_10_amount: その他費用のうち10%対象額(税込)。インボイス税額表示用・任意
--   - tax_8_amount:  その他費用のうち 8%対象☆額(税込・軽減税率)。任意
-- その他費用は施設の自費請求データ(請求ソフト出力の確定額)を最小CSVで取込み、
-- 被保険者番号でレセプト入居者に突合して 1 行追加する。決済額・領収書ともに合算される。
-- 施行規則65条の保険外費用の区分記載に対応(領収書は区分表示)。
-- ============================================================
ALTER TABLE public.statement_lines
  ADD COLUMN IF NOT EXISTS cost_kind VARCHAR(16) NOT NULL DEFAULT 'insurance',
  ADD COLUMN IF NOT EXISTS tax_10_amount INTEGER,
  ADD COLUMN IF NOT EXISTS tax_8_amount INTEGER;

COMMENT ON COLUMN public.statement_lines.cost_kind
  IS 'insurance=保険分(レセプト由来) / other=その他費用(保険外・自費請求)';
COMMENT ON COLUMN public.statement_lines.tax_10_amount
  IS 'その他費用の10%対象額(税込)。任意(インボイス税額表示用)';
COMMENT ON COLUMN public.statement_lines.tax_8_amount
  IS 'その他費用の8%対象☆額(税込・軽減税率)。任意';
