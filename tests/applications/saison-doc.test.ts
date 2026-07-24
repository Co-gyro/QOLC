/**
 * saison-doc（セゾン審査FMT生成）のテスト
 * 実テンプレート（templates/saison-shinsa-fmt.xlsx）への転記まで検証する。
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import ExcelJS from "exceljs";

import {
  buildSaisonRow,
  fillSaisonWorkbook,
  buildSaisonFilename,
  SAISON_DATA_ROW,
} from "@/lib/merchant-application/saison-doc";

const PAYLOAD = {
  corpType: "法人",
  corpName: "株式会社サンプルケア",
  corpNameKana: "カブシキガイシャサンプルケア",
  corporateNumber: "1234567890123",
  postalCode: "105-0004",
  address: "東京都港区新橋1-1-1",
  phone: "03-1234-5678",
  repLastName: "佐藤",
  repFirstName: "花子",
  repLastNameKana: "サトウ",
  repFirstNameKana: "ハナコ",
  repBirthdate: "1980-01-02",
  facilityName: "サンプルケアホーム",
  facilityNameKana: "サンプルケアホーム",
  facilityPostalCode: "224-0001",
  facilityAddress: "神奈川県横浜市青葉区1-2-3",
  facilityPhone: "045-123-4567",
};

const UD_INPUT = {
  tenant_addr_kana: "カナガワケンヨコハマシアオバク１－２－３",
  company_addr_kana: "トウキョウトミナトクシンバシ１－１－１",
  handling_products: "介護サービス利用料の収納代行",
  tenant_name_latin: "SAMPLE CARE HOME",
  codes: { mall_code: "A3F2", terminal_id: "3124620001042", assigned_at: "2026-07-24T00:00:00Z" },
};

describe("buildSaisonRow（法人）", () => {
  const { values, errors, manualNotes } = buildSaisonRow(PAYLOAD, UD_INPUT);

  it("必須が揃っていればエラーなし・店舗URLだけ手入力案内", () => {
    expect(errors).toEqual([]);
    expect(manualNotes.join()).toContain("店舗URL");
  });

  it("会社区分・法人番号・カナ半角変換・日付/郵便の形式", () => {
    expect(values.F).toBe("01");
    expect(values.G).toBe("1234567890123");
    expect(values.J).toBe("ｶﾌﾞｼｷｶﾞｲｼｬｻﾝﾌﾟﾙｹｱ");
    expect(values.R).toBe("ｻﾄｳ ﾊﾅｺ");
    expect(values.S).toBe("佐藤　花子");
    expect(values.U).toBe("19800102");
    expect(values.L).toBe("1050004");
    expect(values.AC).toBe("2240001");
    expect(values.Z).toBe("ｻﾝﾌﾟﾙｹｱﾎｰﾑ");
    expect(values.AD).toBe("ｶﾅｶﾞﾜｹﾝﾖｺﾊﾏｼｱｵﾊﾞｸ1-2-3");
  });

  it("相手先管理番号=モールコード・英字名・固定申告値（非対面トークン）", () => {
    expect(values.AQ).toBe("A3F2");
    expect(values.CS).toBe("SAMPLE CARE HOME");
    expect(values.BB).toBe("00");
    expect(values.BG).toBe("2");
    expect(values.BH).toBe("1");
    expect(values.BJ).toBe("2");
    expect(values.BN).toBe("1");
    // 個人時必須列は法人では埋めない
    expect(values.T).toBeUndefined();
    expect(values.V).toBeUndefined();
  });
});

describe("buildSaisonRow（個人事業主）", () => {
  it("会社区分02・法人番号なしOK・代表者住所欄に申込者住所を転記", () => {
    const { values, errors } = buildSaisonRow(
      { ...PAYLOAD, corpType: "個人事業主", corporateNumber: "" },
      UD_INPUT
    );
    expect(errors).toEqual([]);
    expect(values.F).toBe("02");
    expect(values.G).toBeUndefined();
    expect(values.T).toBe("03");
    expect(values.V).toBe("1050004");
    expect(values.W).toBe("ﾄｳｷｮｳﾄﾐﾅﾄｸｼﾝﾊﾞｼ1-1-1");
    expect(values.X).toBe("東京都港区新橋1-1-1");
  });
});

describe("buildSaisonRow（不足時）", () => {
  it("何を先に済ませるべきかのメッセージを返す", () => {
    const { errors } = buildSaisonRow({ corpType: "法人" }, null);
    const all = errors.join();
    expect(all).toContain("フリガナ");
    expect(all).toContain("法人番号");
    expect(all).toContain("施設住所フリガナ");
    expect(all).toContain("採番");
  });
});

describe("fillSaisonWorkbook（実テンプレートへの転記）", () => {
  it("新規FMTシートの4行目に値が書き込まれ、他セルは壊れない", async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(path.join(process.cwd(), "templates", "saison-shinsa-fmt.xlsx"));
    const { values, errors } = buildSaisonRow(PAYLOAD, UD_INPUT);
    expect(errors).toEqual([]);
    fillSaisonWorkbook(wb, values);
    const ws = wb.getWorksheet("新規FMT")!;
    const row = ws.getRow(SAISON_DATA_ROW);
    expect(row.getCell("K").value).toBe("株式会社サンプルケア");
    expect(row.getCell("J").value).toBe("ｶﾌﾞｼｷｶﾞｲｼｬｻﾝﾌﾟﾙｹｱ");
    expect(row.getCell("AQ").value).toBe("A3F2");
    // ヘッダ行は無傷
    expect(String(ws.getRow(2).getCell("C").value)).toContain("法人コード");
    // セゾン補記列（C=法人コード等）には書き込まない
    expect(row.getCell("C").value ?? null).toBeNull();
  });
});

describe("buildSaisonFilename", () => {
  it("セゾン新規_YYYYMMDD_名称.xlsx 形式", () => {
    expect(buildSaisonFilename("サンプルケアホーム", { year: 2026, month: 7, day: 24 })).toBe(
      "セゾン新規_20260724_サンプルケアホーム.xlsx"
    );
  });
});
