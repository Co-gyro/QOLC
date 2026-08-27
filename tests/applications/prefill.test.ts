import { describe, expect, it } from "vitest";

import { buildJcbPrefill } from "@/app/admin/merchant-application/_lib/prefill";

const PAYLOAD = {
  corpType: "法人",
  corpName: "株式会社ユニバーサル・デベロップメント",
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
    expect(out.companyNameKanji).toBe("株式会社ユニバーサル・デベロップメント");
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

  it("フリガナは全角カタカナ→半角カナに変換して転記する", () => {
    const out = buildJcbPrefill(
      {
        ...PAYLOAD,
        corpNameKana: "カブシキガイシャサンプルデベロップ",
        repLastNameKana: "サトウ",
        repFirstNameKana: "ハナコ",
        facilityNameKana: "サンプルホーム",
      },
      null
    );
    expect(out.companyNameKana).toBe("ｶﾌﾞｼｷｶﾞｲｼｬｻﾝﾌﾟﾙﾃﾞﾍﾞﾛｯﾌﾟ");
    expect(out.repFamilyNameKana).toBe("ｻﾄｳ");
    expect(out.repNameKana).toBe("ﾊﾅｺ");
    expect(out.tenantNameKana).toBe("ｻﾝﾌﾟﾙﾎｰﾑ");
  });

  it("UD補足の申請書用項目（アルファベット・業種内容・取扱商材）を転記する", () => {
    const out = buildJcbPrefill(PAYLOAD, {
      tenant_name_latin: "SAMPLE CARE HOME",
      biz_overview: "有料老人ホームの運営",
      handling_products: "介護サービス利用料の収納代行",
    });
    expect(out.tenantNameLatin).toBe("SAMPLE CARE HOME");
    expect(out.bizOverview).toBe("有料老人ホームの運営");
    expect(out.handlingProducts).toBe("介護サービス利用料の収納代行");
  });

  it("申請前採番（ud_input.codes）をモールコード・POS支店コードへ自動転記する", () => {
    const out = buildJcbPrefill(PAYLOAD, {
      codes: { mall_code: "A3F2", terminal_id: "3124620001042", assigned_at: "2026-07-21T00:00:00Z" },
    });
    expect(out.merchantUseNo).toBe("A3F2");
    expect(out.posBranchCode1).toBe("3124620001042");
  });

  it("未採番なら手入力欄を上書きしない（undefined のまま）", () => {
    const out = buildJcbPrefill(PAYLOAD, null);
    expect(out.merchantUseNo).toBeUndefined();
    expect(out.posBranchCode1).toBeUndefined();
  });

  it("payload が null / 空でも例外を出さず、未入力キーは含めない", () => {
    const out = buildJcbPrefill(null, null);
    expect(out).toEqual({});
    const partial = buildJcbPrefill({ facilityName: "施設B" }, null);
    expect(partial.tenantNameKanji).toBe("施設B");
    expect("companyNameKanji" in partial).toBe(false);
  });
});

describe("住所フリガナ・契約コードまわり", () => {
  it("UD補足の住所フリガナを半角カナ＋半角数字に変換して転記する", () => {
    const out = buildJcbPrefill(PAYLOAD, {
      company_addr_kana: "トウキョウトミナトクシンバシ１－１－１３",
      tenant_addr_kana: "カナガワケンヨコハマシアオバク１－２－３",
    });
    expect(out.companyAddrKana).toBe("ﾄｳｷｮｳﾄﾐﾅﾄｸｼﾝﾊﾞｼ1-1-13");
    expect(out.tenantAddrKana).toBe("ｶﾅｶﾞﾜｹﾝﾖｺﾊﾏｼｱｵﾊﾞｸ1-2-3");
  });

  it("個人事業主は会社住所フリガナが代表者住所カナにも入る", () => {
    const out = buildJcbPrefill(
      { ...PAYLOAD, corpType: "個人事業主" },
      { company_addr_kana: "トウキョウトセタガヤク１－９" }
    );
    expect(out.repAddrKana).toBe("ﾄｳｷｮｳﾄｾﾀｶﾞﾔｸ1-9");
  });
});
