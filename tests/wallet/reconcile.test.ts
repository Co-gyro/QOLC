import { describe, expect, it } from "vitest";
import { merchantSimilar, reconcile, type ReconcileDeclaration, type ReconcileLine } from "@/lib/wallet/reconcile";

const F = "facility-1";
const C = "card-1";

/** 明細行を作る */
function line(id: string, amount: number, usageDate = "2026-10-13", extra: Partial<ReconcileLine> = {}): ReconcileLine {
  return { id, lineNo: Number(id.replace(/\D/g, "")) || 1, cardId: C, facilityId: F, usageDate, merchantName: "ファミリーマート", amount, isReference: false, ...extra };
}
/** 記録を作る */
function decl(id: string, amount: number, purchaseDate = "2026-10-13", extra: Partial<ReconcileDeclaration> = {}): ReconcileDeclaration {
  return { id, facilityId: F, cardId: C, amount, purchaseDate, merchantName: "FamilyMart 内幸町店", paidAt: `${purchaseDate}T01:00:00Z`, ...extra };
}

describe("reconcile", () => {
  it("1件一致", () => {
    const r = reconcile([line("L1", 129)], [decl("D1", 129)]);
    expect(r.lines[0]).toMatchObject({ status: "matched", declarationId: "D1" });
    expect(r.unmatchedDeclarationIds).toEqual([]);
  });

  it("計上日のずれは前後1日まで許す", () => {
    expect(reconcile([line("L1", 500, "2026-10-14")], [decl("D1", 500, "2026-10-13")]).lines[0].status).toBe("matched");
    expect(reconcile([line("L1", 500, "2026-10-15")], [decl("D1", 500, "2026-10-13")]).lines[0].status).toBe("needs_review");
  });

  it("同日同額・同じ店の複数件は、順に割り当てる", () => {
    const r = reconcile([line("L1", 300), line("L2", 300)], [decl("D1", 300), decl("D2", 300)]);
    expect(r.lines.map((l) => l.status)).toEqual(["matched", "matched"]);
    expect(new Set(r.lines.map((l) => l.declarationId))).toEqual(new Set(["D1", "D2"]));
  });

  it("同額でも店が違えば店名で絞る", () => {
    const r = reconcile(
      [line("L1", 300, "2026-10-13", { merchantName: "スーパーマルヤマ" })],
      [decl("D1", 300), decl("D2", 300, "2026-10-13", { merchantName: "スーパーマルヤマ 駅前店" })],
    );
    expect(r.lines[0]).toMatchObject({ status: "matched", declarationId: "D2" });
  });

  it("候補が絞れなければ要確認", () => {
    const r = reconcile(
      [line("L1", 300, "2026-10-13", { merchantName: "ローソン" })],
      [decl("D1", 300, "2026-10-12", { merchantName: "A店" }), decl("D2", 300, "2026-10-14", { merchantName: "B店" })],
    );
    expect(r.lines[0]).toMatchObject({ status: "needs_review", reason: "候補が複数あり特定できない" });
  });

  it("金額が違えば一致しない（記録のない利用）", () => {
    const r = reconcile([line("L1", 130)], [decl("D1", 129)]);
    expect(r.lines[0]).toMatchObject({ status: "needs_review", reason: "記録のない利用" });
    expect(r.unmatchedDeclarationIds).toEqual(["D1"]);
  });

  it("宣言のない明細と、明細のない宣言", () => {
    const r = reconcile([line("L1", 3480)], [decl("D1", 129)]);
    expect(r.lines[0].status).toBe("needs_review");
    expect(r.unmatchedDeclarationIds).toEqual(["D1"]);
  });

  it("対象外の行（手数料・利用日なし）と、登録のないカード", () => {
    const r = reconcile(
      [line("L1", 220, "2026-10-13", { isReference: true }), line("L2", 100, "2026-10-13", { facilityId: null, cardId: null })],
      [decl("D1", 220)],
    );
    expect(r.lines[0]).toMatchObject({ status: "excluded" });
    expect(r.lines[1]).toMatchObject({ status: "needs_review", reason: "登録のないカードの利用" });
  });

  it("別の施設・別のカードの記録とは結びつけない", () => {
    expect(reconcile([line("L1", 129)], [decl("D1", 129, "2026-10-13", { facilityId: "other" })]).lines[0].status).toBe("needs_review");
    expect(reconcile([line("L1", 129)], [decl("D1", 129, "2026-10-13", { cardId: "card-2" })]).lines[0].status).toBe("needs_review");
  });

  it("店名の比較", () => {
    expect(merchantSimilar("ファミリーマート", "ファミリーマート 内幸町")).toBe(true);
    expect(merchantSimilar("ﾌｧﾐﾘｰﾏｰﾄ", "ファミリーマート")).toBe(true);
    expect(merchantSimilar("FamilyMart", "ローソン")).toBe(false);
    expect(merchantSimilar(null, "ローソン")).toBe(false);
  });
});
