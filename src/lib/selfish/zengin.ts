/**
 * 全銀（振込）向け口座名義カナの検証・変換（純関数）
 *
 * Selfish（精算システム）の merchant_accounts.account_name_kana は
 * 全銀許容文字（半角カナ・半角英大文字・数字・() / - . スペース）のみを受け付ける。
 * 文字集合は selfish-web `apps/web/src/lib/masters/rules.ts` の ACCOUNT_NAME_KANA と
 * 同一に保つこと（連携の契約。片側だけ変えない）。
 *
 * 方針: Selfish 側は「変換すれば通る名義」を黙って変換せず運用者の承認を待つ。
 * QOLC 側でも同じく、変換候補は提示するだけで、確定した値のみ保存する。
 */
import { toHalfWidthKana } from "@/lib/utils/kana";

/** 全銀許容文字（Selfish rules.ts と同一集合） */
export const ZENGIN_TEXT_RE = /^[0-9A-Z()\/\-. ｦｰ-ﾟ]+$/;

/** 1文字が全銀許容文字か */
const ZENGIN_CHAR_RE = /^[0-9A-Z()\/\-. ｦｰ-ﾟ]$/;

/**
 * 名義に含まれる全銀非許容文字を重複なしで返す。
 * @returns 空配列なら全銀許容文字のみ
 */
export function findZenginViolations(input: string): string[] {
  const seen = new Set<string>();
  for (const ch of input) {
    if (!ZENGIN_CHAR_RE.test(ch)) seen.add(ch);
  }
  return Array.from(seen);
}

/**
 * 小書きカナ→大書き（全銀文字集合に小書きは無い。例: ﾃﾞﾍﾞﾛｯﾌﾟ → ﾃﾞﾍﾞﾛﾂﾌﾟ）
 * UD 自身の振込依頼人名も「ﾕﾆﾊﾞｰｻﾙﾃﾞﾍﾞﾛﾂﾌﾟﾒﾝﾄ」（大書きﾂ）で登録している。
 */
const SMALL_TO_LARGE_KANA: Record<string, string> = {
  ｧ: "ｱ", ｨ: "ｲ", ｩ: "ｳ", ｪ: "ｴ", ｫ: "ｵ", ｬ: "ﾔ", ｭ: "ﾕ", ｮ: "ﾖ", ｯ: "ﾂ",
};

/** 全角英数記号（U+FF01〜U+FF5E）を ASCII へ寄せる */
function fullWidthAsciiToHalf(ch: string): string {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0xff01 && code <= 0xff5e) return String.fromCodePoint(code - 0xfee0);
  return ch;
}

/** ひらがな（ぁ〜ゖ）をカタカナへ寄せる */
function hiraganaToKatakana(ch: string): string {
  const code = ch.codePointAt(0) ?? 0;
  if (code >= 0x3041 && code <= 0x3096) return String.fromCodePoint(code + 0x60);
  return ch;
}

/**
 * 口座名義を全銀許容文字へ寄せた「変換候補」を返す。
 * - ひらがな→カタカナ→半角カナ、全角英数記号→半角、英小文字→大文字
 * - 小書きカナ（ｯｬｭｮｧｨｩｪｫ）は大書きへ（全銀文字集合に小書きは無い）
 * - 中黒（・）は全銀で使えないためスペースへ（GMOあおぞら受付仕様）
 * - 連続スペースは1つに詰め、前後の空白は落とす
 * 変換しても許容外の文字が残る場合は ok=false（違反文字を列挙）。
 * @param input 入力された名義（全角・半角混在可）
 */
export function suggestZenginKana(input: string): {
  converted: string;
  ok: boolean;
  violations: string[];
} {
  let s = "";
  for (const ch of input) {
    s += fullWidthAsciiToHalf(hiraganaToKatakana(ch));
  }
  s = toHalfWidthKana(s)
    .replace(/[ｧ-ｮｯ]/g, (ch) => SMALL_TO_LARGE_KANA[ch] ?? ch)
    .replace(/[･・]/g, " ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
  const violations = findZenginViolations(s);
  return { converted: s, ok: s !== "" && violations.length === 0, violations };
}
