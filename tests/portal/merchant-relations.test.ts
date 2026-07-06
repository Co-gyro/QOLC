/**
 * merchant-relations（加盟店↔申請・タスクの紐付け集計）のテスト
 */
import { describe, it, expect } from "vitest";

import { groupRelationsByMerchant } from "@/lib/portal/merchant-relations";

describe("groupRelationsByMerchant", () => {
  it("merchant_id ごとに申請とタスクをまとめる", () => {
    const map = groupRelationsByMerchant(
      [
        { id: "a-1", source: "qolc_merchant", status: "done", merchant_id: "m-1" },
        { id: "a-2", source: "jcb_consult", status: "new", merchant_id: "m-2" },
      ],
      [
        { id: "r-1", title: "加盟店申請（都度）", status: "open", merchant_id: "m-1" },
        { id: "r-2", title: "15日締め精算", status: "done", merchant_id: "m-1" },
      ]
    );
    expect(map.get("m-1")).toEqual({
      applications: [{ id: "a-1", source: "qolc_merchant", status: "done" }],
      runs: [
        { id: "r-1", title: "加盟店申請（都度）", status: "open" },
        { id: "r-2", title: "15日締め精算", status: "done" },
      ],
    });
    expect(map.get("m-2")?.applications).toHaveLength(1);
    expect(map.get("m-2")?.runs).toHaveLength(0);
  });

  it("merchant_id が null の行は無視する", () => {
    const map = groupRelationsByMerchant(
      [{ id: "a-1", source: "contact", status: "new", merchant_id: null }],
      [{ id: "r-1", title: "日次運用確認", status: "open", merchant_id: null }]
    );
    expect(map.size).toBe(0);
  });
});
