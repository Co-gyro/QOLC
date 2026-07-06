/**
 * merchant-stage（加盟店申請のステージ判定）のテスト
 */
import { describe, it, expect } from "vitest";

import {
  deriveMerchantStage,
  groupByMerchantStage,
  MERCHANT_STAGE_ORDER,
} from "@/lib/applications/merchant-stage";
import type { ApplicationRow } from "@/lib/applications/types";

const base = (over: Partial<ApplicationRow>): ApplicationRow => ({
  id: "a-1",
  source: "qolc_merchant",
  status: "in_progress",
  priority: "normal",
  applicantName: "山田 太郎",
  applicantOrg: null,
  applicantEmail: null,
  applicantPhone: null,
  message: null,
  assigneeId: null,
  assigneeName: null,
  dueDate: null,
  nextAction: null,
  merchantId: null,
  udInput: null,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  ...over,
});

describe("deriveMerchantStage", () => {
  it("status=new は新規受付", () => {
    expect(deriveMerchantStage(base({ status: "new" }))).toBe("new");
  });

  it("done / rejected は完了・却下", () => {
    expect(deriveMerchantStage(base({ status: "done" }))).toBe("closed");
    expect(deriveMerchantStage(base({ status: "rejected" }))).toBe("closed");
  });

  it("対応中で審査未提出は UD対応中", () => {
    expect(deriveMerchantStage(base({ udInput: null }))).toBe("ud_working");
    expect(deriveMerchantStage(base({ udInput: { settlement_rate: "1.9" } }))).toBe("ud_working");
  });

  it("1社でも提出済みで結果待ちが残っていれば 審査提出中", () => {
    expect(
      deriveMerchantStage(
        base({ udInput: { review: { jcb: { submitted_at: "2026-07-01" } } } })
      )
    ).toBe("under_review");
    // JCB は結果済み・セゾンは結果待ち → まだ審査提出中
    expect(
      deriveMerchantStage(
        base({
          udInput: {
            review: {
              jcb: { submitted_at: "2026-07-01", result: "approved" },
              saison: { submitted_at: "2026-07-02" },
            },
          },
        })
      )
    ).toBe("under_review");
  });

  it("提出済みの全社の結果が確定したら 結果受領・登録処理", () => {
    expect(
      deriveMerchantStage(
        base({
          udInput: {
            review: {
              jcb: { submitted_at: "2026-07-01", result: "approved" },
              saison: { submitted_at: "2026-07-02", result: "rejected" },
            },
          },
        })
      )
    ).toBe("result_processing");
  });

  it("waiting（相手待ち）でも review から段階を判定する", () => {
    expect(
      deriveMerchantStage(
        base({
          status: "waiting",
          udInput: { review: { jcb: { submitted_at: "2026-07-01" } } },
        })
      )
    ).toBe("under_review");
  });
});

describe("groupByMerchantStage", () => {
  it("全ステージのキーを持ち、フロー順に並ぶ", () => {
    const map = groupByMerchantStage([
      base({ id: "a-1", status: "new" }),
      base({ id: "a-2", status: "done" }),
    ]);
    expect(Array.from(map.keys())).toEqual([...MERCHANT_STAGE_ORDER]);
    expect(map.get("new")?.map((r) => r.id)).toEqual(["a-1"]);
    expect(map.get("closed")?.map((r) => r.id)).toEqual(["a-2"]);
    expect(map.get("ud_working")).toEqual([]);
  });
});
