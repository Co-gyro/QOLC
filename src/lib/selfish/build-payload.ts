/**
 * Selfish（精算システム）へ渡す加盟店登録データの組み立て（純関数）
 *
 * 入力: QOLC の加盟店行 + 元申請の顧客入力（payload）+ UD追記（ud_input）
 * 出力: 連携ペイロード `qolc.merchant.v1` と、登録に不足・不正がある項目の一覧
 *
 * 契約（docs/selfish-merchant-sync-design.md §4）:
 *   - 冪等キーは QOLC merchants.id（Selfish merchants.external_id）
 *   - 明細突合キーは店子の加盟店番号: JCB 14桁 / セゾン 加盟店No.7桁 + 店舗No.7桁
 *   - 料率は文字列（浮動小数を経由しない）。カード会社手数料率は Selfish 側の既定値
 * DB アクセスは行わない（API Route / 画面の双方から使う）。
 */
import type { UdInputFields } from "@/lib/applications/ud-input";
import { findZenginViolations, suggestZenginKana } from "./zengin";

/** 連携ペイロードのスキーマ識別子 */
export const SELFISH_PAYLOAD_SCHEMA = "qolc.merchant.v2";

/** カード会社ブランド */
export type SelfishBrand = "JCB" | "SAISON";

/**
 * セゾンの「加盟店店舗No.」の既定値（7桁）。
 * セゾンの売上データ CSV は「加盟店No.(7桁)」と「加盟店店舗No.(7桁)」を別列で持ち、
 * Selfish の突合キーは両者の連結 14 桁。QOLC の merchants.saison_merchant_code には
 * 審査結果で届く「加盟店No.」（店子ごとに発番。例: 2077994）を入れ、店舗No.は
 * 1 店舗運用の既定 0000001 を使う。初回の実 CSV で答え合わせすること（warning を出す）。
 */
export const SAISON_DEFAULT_STORE_NO = "0000001";

/** Selfish 側の口座種別コード（全銀: 1=普通 / 2=当座） */
export type SelfishAccountType = "1" | "2";

/** 連携ペイロード（Selfish `POST /api/partners/merchants` の本文） */
export interface SelfishMerchantPayload {
  schema: typeof SELFISH_PAYLOAD_SCHEMA;
  external_id: string;
  merchant: { name: string };
  store: { name: string; email: string; delivery_channel: "email" };
  account: {
    bank_code: string;
    branch_code: string;
    account_type: SelfishAccountType | "";
    account_number: string;
    account_name_kana: string;
  };
  card_numbers: Array<{
    brand: "JCB" | "SAISON";
    /** Selfish merchant_card_numbers.merchant_number（JCB 14桁 / セゾン 加盟店No.7+店舗No.7） */
    merchant_number: string;
    /** セゾンのみ: 連結前の内訳（答え合わせ用。Selfish は無視してよい） */
    parts?: { merchant_no: string; store_no: string };
  }>;
  fee: {
    valid_from: string;
    /** 加盟店手数料率（QOLC の精算料率）。小数6桁の文字列。全ブランド共通 */
    merchant_fee_rate: string;
    /**
     * カード会社手数料率（UD→カード会社）。ブランドごとに異なるため card_numbers に
     * 載せたブランドの分を必ず含める（v2 で単一欄から変更。既定値なし）
     */
    card_company_fee_rates: Partial<Record<SelfishBrand, string>>;
  };

  source: {
    qolc_merchant_id: string;
    application_id: string | null;
    generated_at: string;
    /** 送信時に QOLC が付与する操作者メール（Selfish 監査ログの actor_id 用） */
    operator_email?: string;
  };
}

/** 不足・不正項目。fix はどの画面で直せるか */
export interface SelfishIssue {
  field: string;
  label: string;
  message: string;
  level: "error" | "warning";
  fix: "ud_input" | "card_codes" | "merchant" | "application";
}

/** 組み立てに使う入力 */
export interface SelfishSource {
  merchant: {
    id: string;
    name: string;
    /** JCB 加盟店番号（登録型）。2026-09-16 JCB回答で1本化され通常 ec と同値 */
    jcbMerchantCodeRecurring: string | null;
    /** JCB 加盟店番号（都度型EC）。recurring と異なる値なら両方送る */
    jcbMerchantCodeEc: string | null;
    saisonMerchantCode: string | null;
  };
  /** 元申請の顧客入力（無い場合は空オブジェクト） */
  applyPayload: { corpName?: string; facilityName?: string; contactEmail?: string };
  /** 元申請の UD 追記（無い場合は空オブジェクト） */
  ud: UdInputFields;
  applicationId: string | null;
  /** 生成時刻（テストで固定するため注入可能） */
  now?: Date;
}

/** 組み立て結果 */
export interface SelfishBuildResult {
  payload: SelfishMerchantPayload;
  issues: SelfishIssue[];
  /** error レベルの issue が無く送信できる状態か */
  ready: boolean;
}

/**
 * パーセント表記の文字列を Selfish の料率文字列（小数6桁）へ変換する。
 * 浮動小数を経由せず桁操作のみで行う（"1.9" → "0.019000"）。
 * @throws 形式が数値でない場合
 */
export function percentTextToRateText(percent: string): string {
  const m = /^(\d{1,2})(?:\.(\d{1,2}))?$/.exec(percent.trim());
  if (!m) throw new Error(`料率の形式が不正です: ${percent}`);
  const frac = (m[2] ?? "").padEnd(4, "0"); // % の小数4桁 = 率の小数6桁
  const digits = (m[1] + frac).padStart(7, "0"); // 率×10^6 を最低7桁
  return `${digits.slice(0, -6)}.${digits.slice(-6)}`;
}

/** 連結後のセゾン加盟店番号（加盟店No.7桁 + 店舗No.7桁） */
export function buildSaisonMerchantNumber(
  merchantNo: string,
  storeNo: string = SAISON_DEFAULT_STORE_NO
): string {
  return `${merchantNo}${storeNo}`;
}

/**
 * Selfish 登録ペイロードを組み立て、不足・不正項目を列挙する。
 * error が1件でもあれば ready=false（送信不可）。warning は送信可だが注意表示。
 */
export function buildSelfishPayload(src: SelfishSource): SelfishBuildResult {
  const issues: SelfishIssue[] = [];
  const err = (field: string, label: string, message: string, fix: SelfishIssue["fix"]) =>
    issues.push({ field, label, message, level: "error", fix });
  const warn = (field: string, label: string, message: string, fix: SelfishIssue["fix"]) =>
    issues.push({ field, label, message, level: "warning", fix });

  const s = (v: string | undefined | null) => (v ?? "").trim();

  // 法人・店舗
  const corpName = s(src.applyPayload.corpName) || s(src.merchant.name);
  const storeName = s(src.merchant.name);
  if (!storeName) err("store.name", "店舗名", "加盟店名が空です", "merchant");
  const email = s(src.applyPayload.contactEmail);
  if (!email) {
    err("store.email", "配信先メール", "元申請のご担当者メールがありません（配信方法 email に必須）", "application");
  }
  if (!src.applicationId) {
    warn("source.application_id", "元申請", "元申請と紐付いていないため、口座・料率は空になります", "application");
  }

  // 口座
  const bankCode = s(src.ud.bank_code);
  if (!/^\d{4}$/.test(bankCode)) err("account.bank_code", "銀行コード", "4桁の数字が必要です", "ud_input");
  const branchCode = s(src.ud.branch_code);
  if (!/^\d{3}$/.test(branchCode)) err("account.branch_code", "支店コード", "3桁の数字が必要です", "ud_input");
  const accountType: SelfishAccountType | "" =
    src.ud.account_type === "ordinary" ? "1" : src.ud.account_type === "checking" ? "2" : "";
  if (!accountType) err("account.account_type", "口座種別", "普通/当座を選択してください", "ud_input");
  const accountNumber = s(src.ud.account_number);
  if (!/^\d{1,7}$/.test(accountNumber)) {
    err("account.account_number", "口座番号", "1〜7桁の数字が必要です", "ud_input");
  }
  const holder = s(src.ud.account_holder);
  if (!holder) {
    err("account.account_name_kana", "口座名義（カナ）", "未入力です", "ud_input");
  } else {
    const violations = findZenginViolations(holder);
    if (violations.length > 0) {
      const hint = suggestZenginKana(holder);
      err(
        "account.account_name_kana",
        "口座名義（カナ）",
        `全銀で使えない文字があります: ${violations.join(" ")}` +
          (hint.ok ? `（変換候補: ${hint.converted}）` : ""),
        "ud_input"
      );
    }
  }

  // 加盟店番号（明細突合キー）
  const cardNumbers: SelfishMerchantPayload["card_numbers"] = [];
  // JCB は DB 上 2 列（登録型 / 都度型EC）。同値なら 1 件、異なれば両方を突合キーとして送る
  const jcbCodes = Array.from(
    new Set([s(src.merchant.jcbMerchantCodeRecurring), s(src.merchant.jcbMerchantCodeEc)].filter(Boolean))
  );
  if (jcbCodes.length === 0) {
    warn("card_numbers.JCB", "JCB加盟店番号", "未登録（JCB 審査通過後に登録）", "card_codes");
  }
  for (const jcb of jcbCodes) {
    if (!/^\d{14}$/.test(jcb)) {
      err("card_numbers.JCB", "JCB加盟店番号", `店子番号は14桁です（${jcb} は ${jcb.length} 桁）`, "card_codes");
    } else {
      cardNumbers.push({ brand: "JCB", merchant_number: jcb });
    }
  }
  const saisonNo = s(src.merchant.saisonMerchantCode);
  if (!saisonNo) {
    warn("card_numbers.SAISON", "セゾン加盟店番号", "未登録（セゾン審査通過後に加盟店No.を登録）", "card_codes");
  } else if (!/^\d{7}$/.test(saisonNo)) {
    err("card_numbers.SAISON", "セゾン加盟店番号", `加盟店No.は7桁です（現在 ${saisonNo.length} 桁）`, "card_codes");
  } else {
    cardNumbers.push({
      brand: "SAISON",
      merchant_number: buildSaisonMerchantNumber(saisonNo, SAISON_DEFAULT_STORE_NO),
      parts: { merchant_no: saisonNo, store_no: SAISON_DEFAULT_STORE_NO },
    });
    warn(
      "card_numbers.SAISON",
      "セゾン加盟店番号",
      `店舗No.は既定 ${SAISON_DEFAULT_STORE_NO} で連結しています。初回のセゾン売上CSVの「加盟店No.」「加盟店店舗No.」と一致するか確認してください`,
      "card_codes"
    );
  }
  if (cardNumbers.length === 0) {
    err("card_numbers", "加盟店番号", "JCB・セゾンのどちらも登録されていません", "card_codes");
  }

  // 料率。加盟店手数料率とカード会社手数料率はどちらも必須（Selfish 側も必須）
  const toRate = (raw: string | undefined, field: string, label: string): string => {
    const percent = s(raw);
    if (!percent) {
      err(field, label, "未入力です", "ud_input");
      return "";
    }
    try {
      return percentTextToRateText(percent);
    } catch {
      err(field, label, `数値として読めません: ${percent}`, "ud_input");
      return "";
    }
  };
  const rate = toRate(src.ud.settlement_rate, "fee.merchant_fee_rate", "精算料率");
  /*
   * カード会社手数料率は JCB/セゾンで違い、加盟店ごとにも違う（既定値なし）。
   * card_numbers に載せるブランドの分だけ必須。旧・共通欄の値が残っていれば暫定で使う（warning）。
   */
  const cardCompanyFeeRates: Partial<Record<SelfishBrand, string>> = {};
  const legacy = s(src.ud.card_company_fee_rate);
  const brandRate: Record<SelfishBrand, string | undefined> = {
    JCB: src.ud.card_company_fee_rate_jcb,
    SAISON: src.ud.card_company_fee_rate_saison,
  };
  const brandLabel: Record<SelfishBrand, string> = { JCB: "JCB", SAISON: "セゾン" };
  for (const brand of ["JCB", "SAISON"] as const) {
    if (!cardNumbers.some((c) => c.brand === brand)) continue;
    const field = `fee.card_company_fee_rates.${brand}`;
    const label = `カード会社手数料率（${brandLabel[brand]}）`;
    if (!s(brandRate[brand]) && legacy) {
      warn(field, label, `未入力のため旧の共通欄の値 ${legacy}% を暫定で使用します。ブランド別に入れ直してください`, "ud_input");
      cardCompanyFeeRates[brand] = toRate(legacy, field, label);
    } else {
      cardCompanyFeeRates[brand] = toRate(brandRate[brand], field, label);
    }
  }
  const validFrom = s(src.ud.fee_valid_from);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) {
    err("fee.valid_from", "料率適用開始日", "YYYY-MM-DD で入力してください（USEN開通確認日が目安）", "ud_input");
  }

  const payload: SelfishMerchantPayload = {
    schema: SELFISH_PAYLOAD_SCHEMA,
    external_id: src.merchant.id,
    merchant: { name: corpName },
    store: { name: storeName, email, delivery_channel: "email" },
    account: {
      bank_code: bankCode,
      branch_code: branchCode,
      account_type: accountType,
      account_number: accountNumber,
      account_name_kana: holder,
    },
    card_numbers: cardNumbers,
    fee: { valid_from: validFrom, merchant_fee_rate: rate, card_company_fee_rates: cardCompanyFeeRates },
    source: {
      qolc_merchant_id: src.merchant.id,
      application_id: src.applicationId,
      generated_at: (src.now ?? new Date()).toISOString(),
    },
  };
  return { payload, issues, ready: !issues.some((i) => i.level === "error") };
}
