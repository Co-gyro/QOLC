/**
 * today-queries（「今日のUD」の純ヘルパー）のテスト
 */
import { describe, it, expect } from "vitest";

import {
  buildMyTasks,
  selectOverdueRuns,
  buildTeamStatus,
  type TodayRun,
  type TodayApplication,
} from "@/lib/portal/today-queries";

const run = (over: Partial<TodayRun>): TodayRun => ({
  id: "r-1",
  title: "2026年7月 15日締め精算",
  dueDate: null,
  assigneeId: null,
  stepStatuses: [],
  category: "settlement",
  ...over,
});

const app = (over: Partial<TodayApplication>): TodayApplication => ({
  id: "a-1",
  source: "qolc_merchant",
  status: "new",
  applicantName: "山田 太郎",
  applicantOrg: null,
  assigneeId: null,
  dueDate: null,
  nextAction: null,
  createdAt: "2026-07-01T00:00:00Z",
  ...over,
});

describe("buildMyTasks", () => {
  it("自分担当の run と申請だけを統合する", () => {
    const items = buildMyTasks(
      [run({ id: "r-1", assigneeId: "me" }), run({ id: "r-2", assigneeId: "other" })],
      [app({ id: "a-1", assigneeId: "me" }), app({ id: "a-2", assigneeId: null })],
      "me"
    );
    expect(items.map((i) => `${i.type}:${i.id}`)).toEqual(["run:r-1", "application:a-1"]);
  });

  it("期限昇順（期限なしは最後）に並ぶ", () => {
    const items = buildMyTasks(
      [
        run({ id: "r-1", assigneeId: "me", dueDate: null }),
        run({ id: "r-2", assigneeId: "me", dueDate: "2026-07-10" }),
      ],
      [app({ id: "a-1", assigneeId: "me", dueDate: "2026-07-05" })],
      "me"
    );
    expect(items.map((i) => i.id)).toEqual(["a-1", "r-2", "r-1"]);
  });

  it("run は進捗（消化数/全数）、申請は次アクション or 状態ラベルを detail に持つ", () => {
    const items = buildMyTasks(
      [run({ id: "r-1", assigneeId: "me", stepStatuses: ["done", "skipped", "todo"] })],
      [
        app({ id: "a-1", assigneeId: "me", nextAction: "書類確認" }),
        app({ id: "a-2", assigneeId: "me", status: "waiting", nextAction: null }),
      ],
      "me"
    );
    expect(items.find((i) => i.id === "r-1")?.detail).toBe("進捗 2/3");
    expect(items.find((i) => i.id === "a-1")?.detail).toBe("次: 書類確認");
    expect(items.find((i) => i.id === "a-2")?.detail).toBe("相手待ち");
  });

  it("run の遷移先は /admin/tasks/[id]", () => {
    const items = buildMyTasks([run({ id: "r-9", assigneeId: "me" })], [], "me");
    expect(items[0].href).toBe("/admin/tasks/r-9");
  });

  it("申請の遷移先は詳細ドロワーを直接開くディープリンク", () => {
    const items = buildMyTasks([], [app({ id: "a-9", assigneeId: "me" })], "me");
    expect(items[0].href).toBe("/admin/applications?open=a-9");
  });

  it("定例カテゴリの run は daily、加盟店カテゴリと申請は adhoc に分類する", () => {
    const items = buildMyTasks(
      [
        run({ id: "r-1", assigneeId: "me", category: "settlement" }),
        run({ id: "r-2", assigneeId: "me", category: "merchant" }),
      ],
      [app({ id: "a-1", assigneeId: "me" })],
      "me"
    );
    const groupOf = (id: string) => items.find((i) => i.id === id)?.group;
    expect(groupOf("r-1")).toBe("daily");
    expect(groupOf("r-2")).toBe("adhoc");
    expect(groupOf("a-1")).toBe("adhoc");
  });
});

describe("selectOverdueRuns", () => {
  it("期限が今日より前の run のみ抽出する", () => {
    const runs = [
      run({ id: "r-1", dueDate: "2026-07-03" }),
      run({ id: "r-2", dueDate: "2026-07-04" }),
      run({ id: "r-3", dueDate: null }),
    ];
    expect(selectOverdueRuns(runs, "2026-07-04").map((r) => r.id)).toEqual(["r-1"]);
  });
});

describe("buildTeamStatus", () => {
  const assignees = [
    { id: "u-1", name: "小平" },
    { id: "u-2", name: "星" },
  ];

  it("担当者ごとの申請・タスク件数を集計する（0件も表示）", () => {
    const t = buildTeamStatus(
      assignees,
      [app({ id: "a-1", assigneeId: "u-1" }), app({ id: "a-2", assigneeId: "u-1" })],
      [run({ id: "r-1", assigneeId: "u-2" })]
    );
    expect(t.members).toEqual([
      { id: "u-1", name: "小平", applicationCount: 2, runCount: 0 },
      { id: "u-2", name: "星", applicationCount: 0, runCount: 1 },
    ]);
    expect(t.unassigned).toEqual({ applicationCount: 0, runCount: 0 });
  });

  it("未割当・未知の担当者IDは unassigned に集約する", () => {
    const t = buildTeamStatus(
      assignees,
      [app({ id: "a-1", assigneeId: null }), app({ id: "a-2", assigneeId: "gone" })],
      [run({ id: "r-1", assigneeId: null })]
    );
    expect(t.unassigned).toEqual({ applicationCount: 2, runCount: 1 });
  });
});
