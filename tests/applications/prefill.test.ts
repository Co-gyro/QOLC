import { describe, expect, it } from "vitest";

import { buildJcbPrefill } from "@/app/admin/merchant-application/_lib/prefill";

const PAYLOAD = {
  corpType: "法人",
  corpName: "ユニバーサルデベロップメント株式会社",
  corporateNumber: "1234567890123",
  postalCode: "105-8555",
  address: "東京都港区1-2-3",
  phone: "03-1234-5678",
  repLastName: "山田",
  repFirstName: "太郎",
  repBirthdate: "1980-01-02",
  facilityName: "介護施設A",
  facilityPostalCode: "1600022",
  facilityAddress: "東京都新宿区4-5-6",
  facilityPhone: "03-9876-5432",
  note: "備考です",
};

describe("buildJcbPrefill（申請ハブ→JCB申請書のプリフィル）", () => {
  it("法人の payload をフォーム初期値へ変換する（郵便番号はハイフン除去）", () => {
    const out = buildJcbPrefill(PAYLOAD, null);
    expect(out.corpIndiv).toBe("1");
    expect(out.companyNameKanji).toBe("ユニバーサルデベロップメント株式会社");
    expect(out.companyPostalCode).toBe("1058555");
    expect(out.companyAddrKanji).toBe("東京都港区1-2-3");
    expect(out.companyTel).toBe("03-1234-5678");
    expect(out.corpNo).toBe("1234567890123");
    expect(out.repFamilyNameKanji).toBe("山田");
    expect(out.repNameKanji).toBe("太郎");
    expect(out.repBirthday).toBe("1980-01-02");
    expect(out.tenantNameKanji).toBe("介護施設A");
    expect(out.tenantPostalCode).toBe("1600022");
    expect(out.tenantAddrKanji).toBe("東京都新宿区4-5-6");
    expect(out.tenantTel).toBe("03-9876-5432");
    expect(out.notes).toBe("備考です");
  });

  it("個人事業主は corpIndiv=3 になり、電話が代表者電話にも入る", () => {
    const out = buildJcbPrefill({ ...PAYLOAD, corpType: "個人事業主" }, null);
    expect(out.corpIndiv).toBe("3");
    expect(out.repTel).toBe("03-1234-5678");
  });

  it("個人事業主は住所・郵便番号も代表者欄へ流す（JCB申請書は個人時に代表者住所が必須）", () => {
    const out = buildJcbPrefill({ ...PAYLOAD, corpType: "個人事業主" }, null);
    expect(out.repPostalCode).toBe(out.companyPostalCode);
    expect(out.repAddrKanji).toBe(out.companyAddrKanji);
  });

  it("法人は代表者住所へ流さない（会社欄のみ）", () => {
    const out = buildJcbPrefill(PAYLOAD, null);
    expect(out.repPostalCode).toBeUndefined();
    expect(out.repAddrKanji).toBeUndefined();
  });

  it("ud_input の業態コードを反映する", () => {
    const out = buildJcbPrefill(PAYLOAD, { biz_cat_code: "60207" });
    expect(out.bizCatCode).toBe("60207");
  });

  it("payload が null / 空でも例外を出さず、未入力キーは含めない", () => {
    const out = buildJcbPrefill(null, null);
    expect(out).toEqual({});
    const partial = buildJcbPrefill({ facilityName: "施設B" }, null);
    expect(partial.tenantNameKanji).toBe("施設B");
    expect("companyNameKanji" in partial).toBe(false);
  });
});
