/**
 * 申請ハブ（applications）→ JCB申請書フォームのプリフィル変換（純関数）
 *
 * 公開申請フォームの payload（merchantApplyFormSchema 準拠のキー）と
 * UD追記情報（ud_input）から JcbEcApplication の初期値を組み立て、
 * 二重入力を排除する。DB アクセスは行わない。
 */
import type { JcbEcApplication } from "@/lib/merchant-application/jcb-ec";
import { parseUdInput } from "@/lib/applications/ud-input";

/** unknown から空でない文字列を取り出す（それ以外は undefined） */
function s(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

/** 郵便番号のハイフンを除去する（JCB申請書は7桁ハイフンなし） */
function stripPostal(v: string | undefined): string | undefined {
  return v?.replace(/-/g, "");
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
  const { fields } = parseUdInput(udInput ?? null);
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
  // UD追記: 業態コード
  assign("bizCatCode", fields.biz_cat_code);
  return out;
}
