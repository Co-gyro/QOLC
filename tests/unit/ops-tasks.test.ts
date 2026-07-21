/**
 * ops-tasks（その他業務タスク）純ロジックのテスト
 */
import { describe, it, expect } from "vitest";

import {
  ALL_OPS_STATUSES,
  OPS_STATUS_LABELS,
  OPS_STATUS_COLORS,
  OPS_RECURRING_RULES,
  compareOpsTasks,
  rulesDueOn,
  buildOpsTaskRow,
  periodOf,
  type OpsTask,
} from "@/lib/ops-tasks/logic";

function task(over: Partial<OpsTask>): OpsTask {
  return {
    id: "t1",
    title: "テストタスク",
    status: "todo",
    category: null,
    assigneeId: null,
    dueDate: null,
    note: null,
    recurringKey: null,
    createdAt: "2026-07-01T00:00:00Z",
    ...over,
  };
}

describe("状態定義", () => {
  it("全状態にラベルと配色が定義されている", () => {
    for (const s of ALL_OPS_STATUSES) {
      expect(OPS_STATUS_LABELS[s]).toBeTruthy();
      expect(OPS_STATUS_COLORS[s].bg).toMatch(/^#/);
    }
  });
});

describe("compareOpsTasks", () => {
  it("対応中→未着手→保留→完了、同状態内は期限昇順（なしは最後）", () => {
    const rows = [
      task({ id: "done", status: "done" }),
      task({ id: "todo-late", status: "todo", dueDate: "2026-07-30" }),
      task({ id: "hold", status: "on_hold" }),
      task({ id: "doing", status: "in_progress" }),
      task({ id: "todo-early", status: "todo", dueDate: "2026-07-10" }),
      task({ id: "todo-nodue", status: "todo" }),
    ];
    expect([...rows].sort(compareOpsTasks).map((t) => t.id)).toEqual([
      "doing",
      "todo-early",
      "todo-late",
      "todo-nodue",
      "hold",
      "done",
    ]);
  });
});

describe("定例起票ルール", () => {
  it("起票日以降のルールだけが対象になる", () => {
    const day4 = rulesDueOn({ year: 2026, month: 8, day: 4 });
    expect(day4.map((r) => r.key)).not.toContain("deposit_check_eom");
    const day5 = rulesDueOn({ year: 2026, month: 8, day: 5 });
    expect(day5.map((r) => r.key)).toContain("deposit_check_eom");
    const day20 = rulesDueOn({ year: 2026, month: 8, day: 20 });
    expect(day20.map((r) => r.key)).toEqual(OPS_RECURRING_RULES.map((r) => r.key));
  });

  it("insert 行を正しく組み立てる（period・期限・タイトル展開）", () => {
    const rule = OPS_RECURRING_RULES.find((r) => r.key === "deposit_check_15")!;
    const row = buildOpsTaskRow(rule, { year: 2026, month: 8, day: 20 });
    expect(row.title).toContain("2026年8月");
    expect(row.status).toBe("todo");
    expect(row.recurring_key).toBe("deposit_check_15");
    expect(row.period).toBe("2026-08");
    expect(row.due_date).toBe("2026-08-28");
  });

  it("periodOf は月をゼロ埋めする", () => {
    expect(periodOf({ year: 2026, month: 7, day: 21 })).toBe("2026-07");
  });

  it("ルールの key は重複しない", () => {
    const keys = OPS_RECURRING_RULES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
