/**
 * today-groups（今日のUD 業務別グルーピング）のテスト
 */
import { describe, it, expect } from "vitest";

import {
  buildTodayGroups,
  addDaysToDateStr,
  GROUP_ITEM_LIMIT,
  POOL_WARN_THRESHOLD,
} from "@/lib/portal/today-groups";
import type { TodayApplication, TodayRun } from "@/lib/portal/today-queries";

const TODAY = "2026-07-21";

function app(over: Partial<TodayApplication>): TodayApplication {
  return {
    id: "a1",
    source: "contact",
    status: "new",
    applicantName: "山本様",
    applicantOrg: "グリーンヒルズ横浜",
    assigneeId: null,
    dueDate: null,
    nextAction: null,
    createdAt: "2026-07-21T00:00:00Z",
    ...over,
  };
}

function run(over: Partial<TodayRun>): TodayRun {
  return {
    id: "r1",
    title: "7月15日締め精算",
    dueDate: null,
    assigneeId: null,
    stepStatuses: ["done", "todo", "todo"],
    category: "settlement",
    ...over,
  };
}

describe("buildTodayGroups", () => {
  it("業務ごとに5グループ（相談/加盟店/日次決済/月次精算/その他）を順番どおり返す", () => {
    const groups = buildTodayGroups([], [], null, null, TODAY);
    expect(groups.map((g) => g.key)).toEqual([
      "inquiries",
      "merchant",
      "daily_payment",
      "settlement",
      "other",
    ]);
    expect(groups.map((g) => g.href)).toEqual([
      "/admin/inquiries",
      "/admin/applications",
      "/admin/payments",
      "/admin/tasks",
      "/admin/other-tasks",
    ]);
  });

  it("申請/相談は source で相談グループと加盟店グループに振り分け、ディープリンクが業務ページを向く", () => {
    const groups = buildTodayGroups(
      [
        app({ id: "q1", source: "jcb_consult" }),
        app({ id: "q2", source: "qolc_merchant" }),
        app({ id: "q3", source: "support_family" }),
      ],
      [],
      null,
      null,
      TODAY
    );
    const inq = groups.find((g) => g.key === "inquiries")!;
    const mer = groups.find((g) => g.key === "merchant")!;
    expect(inq.items.map((i) => i.href)).toEqual([
      "/admin/inquiries/q1",
      "/admin/inquiries/q3",
    ]);
    expect(mer.items.map((i) => i.href)).toEqual(["/admin/applications/q2"]);
  });

  it("run はカテゴリで振り分け、期限超過はアラートとして先頭に並ぶ", () => {
    const groups = buildTodayGroups(
      [],
      [
        run({ id: "r-ok", category: "settlement", dueDate: "2026-07-25" }),
        run({ id: "r-late", category: "settlement", dueDate: "2026-07-19" }),
        run({ id: "r-mer", category: "merchant" }),
        run({ id: "r-unknown", category: null }),
      ],
      null,
      null,
      TODAY
    );
    const st = groups.find((g) => g.key === "settlement")!;
    expect(st.items.map((i) => i.id)).toEqual(["run-r-late", "run-r-ok"]);
    expect(st.items[0].badge.tone).toBe("alert");
    expect(st.items[0].href).toBe("/admin/tasks/r-late");
    // 工程進捗の表記（done+skipped / total）
    expect(st.items[1].sub).toContain("工程 1/3");
    expect(groups.find((g) => g.key === "merchant")!.items.map((i) => i.id)).toContain(
      "run-r-mer"
    );
    expect(groups.find((g) => g.key === "other")!.items.map((i) => i.id)).toEqual([
      "run-r-unknown",
    ]);
  });

  it("決済エラー・保留は日次決済グループに、エラーが先頭に出る", () => {
    const groups = buildTodayGroups([], [], { failed: 2, pending: 3 }, null, TODAY);
    const pay = groups.find((g) => g.key === "daily_payment")!;
    expect(pay.items[0].id).toBe("pay-failed");
    expect(pay.items[0].badge.tone).toBe("alert");
    expect(pay.items[0].href).toBe("/admin/payments?status=failed");
    expect(pay.items[1].id).toBe("pay-pending");
  });

  it("採番プールの残数警告は加盟店グループに出る（しきい値未満のみ）", () => {
    const pool = {
      mallCode: { available: POOL_WARN_THRESHOLD - 1, assigned: 0, total: 100 },
      terminalId: { available: POOL_WARN_THRESHOLD + 5, assigned: 0, total: 100 },
    };
    const groups = buildTodayGroups([], [], null, pool, TODAY);
    const mer = groups.find((g) => g.key === "merchant")!;
    expect(mer.items.map((i) => i.id)).toEqual(["pool-mall"]);
    expect(mer.items[0].badge.tone).toBe("alert");
  });

  it("表示は上限件数で切り、超過分は extraCount に入る", () => {
    const many = Array.from({ length: GROUP_ITEM_LIMIT + 3 }, (_, i) =>
      app({ id: `q${i}`, source: "contact" })
    );
    const inq = buildTodayGroups(many, [], null, null, TODAY).find(
      (g) => g.key === "inquiries"
    )!;
    expect(inq.items).toHaveLength(GROUP_ITEM_LIMIT);
    expect(inq.extraCount).toBe(3);
  });

  it("新着（new）は対応中（in_progress）より先に並ぶ", () => {
    const groups = buildTodayGroups(
      [
        app({ id: "q-doing", status: "in_progress" }),
        app({ id: "q-new", status: "new" }),
      ],
      [],
      null,
      null,
      TODAY
    );
    const inq = groups.find((g) => g.key === "inquiries")!;
    expect(inq.items.map((i) => i.id)).toEqual(["app-q-new", "app-q-doing"]);
  });
});

describe("その他業務（ops_tasks）", () => {
  const ops = (over: Record<string, unknown>) => ({
    id: "t1",
    title: "セゾン入金確認",
    status: "todo" as const,
    category: "入金管理",
    assigneeId: null,
    dueDate: null,
    note: null,
    recurringKey: null,
    createdAt: "2026-07-01T00:00:00Z",
    ...over,
  });

  it("期限接近・期限超過・対応中だけが今日のUDに出る", () => {
    const groups = buildTodayGroups(
      [],
      [],
      null,
      null,
      TODAY,
      [
        ops({ id: "soon", dueDate: "2026-07-23" }), // 3日以内 → 出る
        ops({ id: "far", dueDate: "2026-08-15" }), // 遠い → 出ない
        ops({ id: "late", dueDate: "2026-07-19" }), // 超過 → アラート
        ops({ id: "doing", status: "in_progress" }), // 対応中 → 出る
        ops({ id: "nodue" }), // 期限なし未着手 → 出ない
        ops({ id: "closed", status: "done", dueDate: "2026-07-19" }), // 完了 → 出ない
      ]
    );
    const other = groups.find((g) => g.key === "other")!;
    expect(other.href).toBe("/admin/other-tasks");
    // 並びはトーン順（alert=超過 → new=未着手 → doing=対応中）
    expect(other.items.map((i) => i.id)).toEqual(["ops-late", "ops-soon", "ops-doing"]);
    expect(other.items[0].badge).toEqual({ label: "期限超過", tone: "alert" });
  });

  it("addDaysToDateStr は月またぎを正しく計算する", () => {
    expect(addDaysToDateStr("2026-07-30", 3)).toBe("2026-08-02");
  });
});
