-- ============================================================
-- 028_add_koufu_amount_to_statement_lines.sql
-- 介護保険レセプトの「公費負担額」(公費請求額＝公費が肩代わりした額)を保持する。
-- 公費併用(生活保護・54指定難病等)のとき、領収書で保険給付額とは独立に
-- 「公費負担額」を区分表示するため(星さんFB)。公費が無い場合は 0。
--
-- 金額の関係:
--   費用総額 = 介護保険給付額 + 公費負担額(本列) + 本人負担額(self_pay_amount)
--   本人負担額(self_pay) = レセプト[利用者負担額] − 公費負担額  (= 公費分本人負担)
-- ============================================================
ALTER TABLE public.statement_lines
  ADD COLUMN IF NOT EXISTS koufu_amount INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.statement_lines.koufu_amount
  IS '公費負担額(公費請求額・円)。介護レセプトの公費請求額合計。公費なしは0';
