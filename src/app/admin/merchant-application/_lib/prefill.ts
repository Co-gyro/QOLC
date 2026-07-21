/**
 * 申請ハブ（applications）→ JCB申請書フォームのプリフィル変換（純関数）
 *
 * 公開申請フォームの payload（merchantApplyFormSchema 準拠のキー）と
 * UD追記情報（ud_input）から JcbEcApplication の初期値を組み立て、
 * 二重入力を排除する。DB アクセスは行わない。
 */
import type { JcbEcApplication } from "@/lib/merchant-application/jcb-ec";
import { parseUdInput } from "@/lib/applications/ud-input";
import { toHalfWidthKana } from "@/lib/utils/kana";

/** unknown から空でない文字列を取り出す（それ以外は undefined） */
function s(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** 郵便番号のハイフンを除去する（JCB申請書は7桁ハイフンなし） */
function stripPostal(v: string | undefined): string | undefined {
  return v?.replace(/-/g, "");
}

/** 全角カタカナ → 半角カナ（JCB申請書のカナ欄は半角カナ必須） */
function halfKana(v: string | undefined): string | undefined {
  return v === undefined ? undefined : toHalfWidthKana(v);
}

/**
 * 申請の payload + ud_input から JCB EC 申請フォームの初期値を構築する。
 * 未入力の項目は含めない（フォーム側の EMPTY 値が使われる）。
 * @param payload 顧客入力（corpName / facilityName など）
 * @param udInput UD追記情報（業態コード等）
 */
export function buildJcbPrefill(
  payload: Record<string, unknown> | null | undefined,
  udInput: Record<string, unknown> | null | undefined
): Partial<JcbEcApplication> {
  const p = payload ?? {};
  const { fields, codes } = parseUdInput(udInput ?? null);
  const isIndividual = s(p.corpType) === "個人事業主";

  const out: Partial<JcbEcApplication> = {};
  const assign = <K extends keyof JcbEcApplication>(
    key: K,
    value: string | undefined
  ): void => {
    if (value !== undefined) out[key] = value as JcbEcApplication[K];
  };

  // 法人/個人区分: 法人=1（法人番号あり）/ 個人事業主=3
  assign("corpIndiv", isIndividual ? "3" : s(p.corpType) === "法人" ? "1" : undefined);
  assign("companyNameKanji", s(p.corpName));
  // フリガナ（公開フォームで全角カタカナ収集）→ JCB要求の半角カナへ自動変換
  assign("companyNameKana", halfKana(s(p.corpNameKana)));
  assign("repFamilyNameKana", halfKana(s(p.repLastNameKana)));
  assign("repNameKana", halfKana(s(p.repFirstNameKana)));
  assign("tenantNameKana", halfKana(s(p.facilityNameKana)));
  assign("companyPostalCode", stripPostal(s(p.postalCode)));
  assign("companyAddrKanji", s(p.address));
  assign("companyTel", s(p.phone));
  assign("corpNo", s(p.corporateNumber));
  if (isIndividual) {
    // 個人事業主は JCB 申請書で会社欄が空欄化され、代わりに代表者住所・電話が必須になる。
    // お客様入力の住所・郵便・電話を代表者欄にも流し、UD の再入力漏れ（＝申請不能）を防ぐ。
    assign("repTel", s(p.phone));
    assign("repPostalCode", stripPostal(s(p.postalCode)));
    assign("repAddrKanji", s(p.address));
  }
  assign("repFamilyNameKanji", s(p.repLastName));
  assign("repNameKanji", s(p.repFirstName));
  assign("repBirthday", s(p.repBirthdate));
  assign("tenantNameKanji", s(p.facilityName));
  assign("tenantPostalCode", stripPostal(s(p.facilityPostalCode)));
  assign("tenantAddrKanji", s(p.facilityAddress));
  assign("tenantTel", s(p.facilityPhone));
  assign("notes", s(p.note));
  // UD追記: 業態コード・申請書用補足（アルファベット店舗名・業種内容・取扱商材・住所カナ）
  assign("bizCatCode", fields.biz_cat_code);
  assign("tenantNameLatin", fields.tenant_name_latin);
  assign("bizOverview", fields.biz_overview);
  assign("handlingProducts", fields.handling_products);
  assign("companyAddrKana", halfKana(fields.company_addr_kana));
  assign("tenantAddrKana", halfKana(fields.tenant_addr_kana));
  if (isIndividual) assign("repAddrKana", halfKana(fields.company_addr_kana));
  // 申請前採番（ud_input.codes）: 手入力による採番プールとの齟齬を防ぐため自動転記する
  if (codes) {
    assign("merchantUseNo", codes.mall_code);
    assign("posBranchCode1", codes.terminal_id);
  }
  return out;
}
