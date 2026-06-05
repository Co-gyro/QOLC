/**
 * 医療保険 UKE パーサーのユニットテスト
 */
import { describe, it, expect } from "vitest";
import { parseIryouUke } from "../../src/lib/receipt/iryou-uke";

describe("parseIryouUke", () => {
  it("空入力では患者が空", () => {
    const result = parseIryouUke([]);
    expect(result.patients).toEqual([]);
    expect(result.institution).toBeNull();
  });

  it("HM + RE + HO の最小構成で患者1名 + HOから一部負担金額を取得", () => {
    const rows = [
      ["HM", "2", "10", "6", "190673", "訪問看護ステーション　かしの樹", "202605", "272890120"],
      ["RE", "1", "6122", "202604", "古谷　敏雄", "コヤトシオ", "1", "19570206", "", "", "70", "229", "", "202605-11534987-0"],
      ["HO", "100016", "ま", "717-6128", "23", "302580", "", "", "10000"],
    ];
    const result = parseIryouUke(rows);
    expect(result.institution).toMatchObject({
      code: "190673",
      name: "訪問看護ステーション　かしの樹",
      processingMonth: "202605",
    });
    expect(result.patients).toHaveLength(1);
    const p = result.patients[0];
    expect(p.name).toBe("古谷　敏雄");
    expect(p.serviceMonth).toBe("202604");
    expect(p.hoken).toMatchObject({
      hokenshaNumber: "100016",
      kigou: "ま",
      bangou: "717-6128",
      totalAmount: 302580,
      userBurden: 10000,
    });
    expect(p.userBurden).toBe(10000);
  });

  it("複数患者(RE+HO)が正しく分離される", () => {
    const rows = [
      ["HM", "2", "10", "6", "190673", "...", "202605", "..."],
      ["RE", "1", "6122", "202604", "古谷　敏雄"],
      ["HO", "100016", "ま", "717-6128", "23", "302580", "", "", "10000"],
      ["RE", "2", "6116", "202604", "清水　昇"],
      ["HO", "110171", "こうのす", "77666", "30", "398340", "", "", "24600"],
    ];
    const result = parseIryouUke(rows);
    expect(result.patients).toHaveLength(2);
    expect(result.patients[0].userBurden).toBe(10000);
    expect(result.patients[1].userBurden).toBe(24600);
  });

  it("HOがなく KOのみ(支払基金型)の場合は KO一部負担金額を本人負担とする", () => {
    const rows = [
      ["HM", "1", "10", "6", "190673", "...", "202605", "..."],
      ["RE", "1", "6212", "202604", "萩原　道子"],
      ["KO", "12101010", "527929", "", "30", "399090", "5000"],
    ];
    const result = parseIryouUke(rows);
    expect(result.patients[0].hoken).toBeNull();
    expect(result.patients[0].kofu).toHaveLength(1);
    expect(result.patients[0].kofu[0].userBurden).toBe(5000);
    expect(result.patients[0].userBurden).toBe(5000);
  });

  it("HOもKOも本人負担=0なら患者の userBurden は0で警告対象", () => {
    const rows = [
      ["RE", "1", "6212", "202604", "生保さん"],
      ["KO", "12101010", "527929", "", "30", "399090", "0"],
    ];
    const result = parseIryouUke(rows);
    expect(result.patients[0].userBurden).toBe(0);
    expect(result.warnings.some((w) => w.code === "ZERO_USER_BURDEN")).toBe(true);
  });

  it("REの前にHOが来た場合は ORPHAN_HO 警告", () => {
    const rows = [
      ["HM", "2", "10", "6", "190673", "...", "202605", "..."],
      ["HO", "100016", "ま", "717-6128", "23", "302580", "", "", "10000"],
    ];
    const result = parseIryouUke(rows);
    expect(result.patients).toEqual([]);
    expect(result.warnings.some((w) => w.code === "ORPHAN_HO")).toBe(true);
  });

  it("複数のKO公費を持つ患者の本人負担は KO合計", () => {
    const rows = [
      ["RE", "1", "6212", "202604", "難病さん"],
      ["KO", "12101010", "527929", "", "30", "399090", "3000"],
      ["KO", "54106026", "109991", "", "30", "200000", "2000"],
    ];
    const result = parseIryouUke(rows);
    expect(result.patients[0].kofu).toHaveLength(2);
    expect(result.patients[0].userBurden).toBe(5000);
  });

  it("SY/KA等の未使用レコードはスキップされる", () => {
    const rows = [
      ["RE", "1", "6122", "202604", "古谷　敏雄"],
      ["HO", "100016", "ま", "717-6128", "23", "302580", "", "", "10000"],
      ["SY", "1", "...", "..."],
      ["KA", "1", "...", "..."],
      ["MF", "01"],
    ];
    const result = parseIryouUke(rows);
    expect(result.patients).toHaveLength(1);
    expect(result.patients[0].userBurden).toBe(10000);
  });
});
