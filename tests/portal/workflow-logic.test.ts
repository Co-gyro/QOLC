/**
 * workflow-logic（run/step/Cron の純ロジック）のテスト
 */
import { describe, it, expect } from "vitest";

import {
  computeRunProgress,
  shouldAutoCompleteRun,
  stepCompletionFields,
  toJstDateString,
  defaultRunTitle,
  shouldTriggerRule,
  isOverdue,
  resolveCurrentStepIndex,
  categoryToTaskGroup,
  type TriggerRuleInput,
} from "@/lib/portal/workflow-logic";

describe("computeRunProgress", () => {
  it("done / skipped / total を集計する", () => {
    expect(computeRunProgress(["done", "todo", "skipped", "done"])).toEqual({
      done: 2,
      skipped: 1,
      total: 4,
    });
  });
  it("空配列は 0/0/0", () => {
    expect(computeRunProgress([])).toEqual({ done: 0, skipped: 0, total: 0 });
  });
});

describe("shouldAutoCompleteRun", () => {
  it("全ステップが todo 以外なら自動完了", () => {
    expect(shouldAutoCompleteRun(["done", "skipped", "done"])).toBe(true);
  });
  it("todo が1つでも残っていれば完了しない", () => {
    expect(shouldAutoCompleteRun(["done", "todo"])).toBe(false);
  });
  it("ステップ0件は自動完了しない", () => {
    expect(shouldAutoCompleteRun([])).toBe(false);
  });
});

describe("stepCompletionFields", () => {
  const now = "2026-07-04T01:00:00.000Z";
  it("done は操作者と時刻を記録する", () => {
    expect(stepCompletionFields("done", "user-1", now)).toEqual({
      status: "done",
      completed_by: "user-1",
      completed_at: now,
    });
  });
  it("skipped も操作者と時刻を記録する", () => {
    expect(stepCompletionFields("skipped", "user-1", now)).toEqual({
      status: "skipped",
      completed_by: "user-1",
      completed_at: now,
    });
  });
  it("todo に戻すと両方クリアする", () => {
    expect(stepCompletionFields("todo", "user-1", now)).toEqual({
      status: "todo",
      completed_by: null,
      completed_at: null,
    });
  });
});

describe("toJstDateString", () => {
  it("ゼロ埋めして YYYY-MM-DD を返す", () => {
    expect(toJstDateString({ year: 2026, month: 7, day: 4 })).toBe("2026-07-04");
    expect(toJstDateString({ year: 2026, month: 12, day: 31 })).toBe("2026-12-31");
  });
});

describe("defaultRunTitle", () => {
  it("テンプレ名＋起票日でタイトルを作る", () => {
    expect(defaultRunTitle("加盟店申請（都度）", { year: 2026, month: 7, day: 4 })).toBe(
      "加盟店申請（都度）（2026/7/4 起票）"
    );
  });
});

describe("shouldTriggerRule", () => {
  const today = { year: 2026, month: 7, day: 20 };
  const base: TriggerRuleInput = {
    enabled: true,
    cadence: "monthly",
    day_of_month: 20,
    last_run_on: null,
  };

  it("monthly: day_of_month 一致かつ未起票なら true", () => {
    expect(shouldTriggerRule(base, today)).toBe(true);
  });
  it("monthly: day_of_month 不一致なら false", () => {
    expect(shouldTriggerRule({ ...base, day_of_month: 5 }, today)).toBe(false);
  });
  it("monthly: 当日すでに起票済み（last_run_on=今日）なら false（多重防止）", () => {
    expect(shouldTriggerRule({ ...base, last_run_on: "2026-07-20" }, today)).toBe(false);
  });
  it("monthly: last_run_on が過去日なら true", () => {
    expect(shouldTriggerRule({ ...base, last_run_on: "2026-06-20" }, today)).toBe(true);
  });
  it("monthly: day_of_month が null なら false", () => {
    expect(shouldTriggerRule({ ...base, day_of_month: null }, today)).toBe(false);
  });
  it("daily: last_run_on ≠ 今日なら true", () => {
    expect(
      shouldTriggerRule(
        { enabled: true, cadence: "daily", day_of_month: null, last_run_on: "2026-07-19" },
        today
      )
    ).toBe(true);
  });
  it("daily: last_run_on = 今日なら false", () => {
    expect(
      shouldTriggerRule(
        { enabled: true, cadence: "daily", day_of_month: null, last_run_on: "2026-07-20" },
        today
      )
    ).toBe(false);
  });
  it("enabled=false は常に false", () => {
    expect(shouldTriggerRule({ ...base, enabled: false }, today)).toBe(false);
  });
});

describe("isOverdue", () => {
  it("期限が今日より前なら超過", () => {
    expect(isOverdue("2026-07-03", "2026-07-04")).toBe(true);
  });
  it("期限が今日なら超過ではない", () => {
    expect(isOverdue("2026-07-04", "2026-07-04")).toBe(false);
  });
  it("期限なし（null）は超過ではない", () => {
    expect(isOverdue(null, "2026-07-04")).toBe(false);
  });
});

describe("resolveCurrentStepIndex", () => {
  it("最初の todo の添字を返す（skipped は消化済み扱い）", () => {
    expect(resolveCurrentStepIndex(["done", "skipped", "todo", "todo"])).toBe(2);
  });
  it("全ステップ消化済みなら -1（現在地なし＝完了）", () => {
    expect(resolveCurrentStepIndex(["done", "skipped"])).toBe(-1);
  });
  it("未着手なら先頭が現在地", () => {
    expect(resolveCurrentStepIndex(["todo", "todo"])).toBe(0);
  });
});

describe("categoryToTaskGroup", () => {
  it("settlement / daily は日々の運用（daily）", () => {
    expect(categoryToTaskGroup("settlement")).toBe("daily");
    expect(categoryToTaskGroup("daily")).toBe("daily");
  });
  it("merchant や未知カテゴリ・null は都度の対応（adhoc）", () => {
    expect(categoryToTaskGroup("merchant")).toBe("adhoc");
    expect(categoryToTaskGroup("unknown")).toBe("adhoc");
    expect(categoryToTaskGroup(null)).toBe("adhoc");
  });
});
