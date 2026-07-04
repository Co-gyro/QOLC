import { describe, it, expect } from "vitest";

import {
  buildRunSteps,
  formatTitlePattern,
  getJstDateParts,
  previousMonth,
  validateTemplateSteps,
} from "@/lib/workflow/utils";
import type { WorkflowTemplateStep } from "@/lib/workflow/types";

describe("getJstDateParts", () => {
  it("UTC 0:00 は JST 9:00（同日）", () => {
    expect(getJstDateParts(new Date("2026-07-20T00:00:00Z"))).toEqual({
      year: 2026,
      month: 7,
      day: 20,
    });
  });
  it("UTC 15:00 は JST 翌日0:00（日付が繰り上がる）", () => {
    expect(getJstDateParts(new Date("2026-07-20T15:00:00Z"))).toEqual({
      year: 2026,
      month: 7,
      day: 21,
    });
  });
  it("年跨ぎ（UTC 12/31 15:00 → JST 1/1）", () => {
    expect(getJstDateParts(new Date("2026-12-31T15:00:00Z"))).toEqual({
      year: 2027,
      month: 1,
      day: 1,
    });
  });
});

describe("previousMonth", () => {
  it("通常月は前月", () => {
    expect(previousMonth({ year: 2026, month: 7, day: 5 })).toEqual({ year: 2026, month: 6 });
  });
  it("1月は前年12月", () => {
    expect(previousMonth({ year: 2026, month: 1, day: 5 })).toEqual({ year: 2025, month: 12 });
  });
});

describe("formatTitlePattern", () => {
  const parts = { year: 2026, month: 7, day: 20 };
  it("{year}/{month} を置換する", () => {
    expect(formatTitlePattern("{year}年{month}月 15日締め精算", parts)).toBe(
      "2026年7月 15日締め精算"
    );
  });
  it("{day} を置換する", () => {
    expect(formatTitlePattern("{year}年{month}月{day}日 日次運用確認", parts)).toBe(
      "2026年7月20日 日次運用確認"
    );
  });
  it("{prev_year}/{prev_month} を置換する（末日締め精算用）", () => {
    expect(
      formatTitlePattern("{prev_year}年{prev_month}月 末日締め精算", {
        year: 2026,
        month: 1,
        day: 5,
      })
    ).toBe("2025年12月 末日締め精算");
  });
  it("プレースホルダなしはそのまま", () => {
    expect(formatTitlePattern("固定タイトル", parts)).toBe("固定タイトル");
  });
});

describe("buildRunSteps", () => {
  const steps: WorkflowTemplateStep[] = [
    { seq: 2, title: "B", guide: "b" },
    {
      seq: 1,
      title: "A",
      guide: "a",
      external_url: "/admin/csv-tools",
      external_label: "開く",
    },
  ];

  it("seq 昇順に整列してスナップショットを生成する", () => {
    const rows = buildRunSteps({ steps });
    expect(rows.map((r) => r.seq)).toEqual([1, 2]);
    expect(rows[0]).toEqual({
      seq: 1,
      title: "A",
      guide: "a",
      external_url: "/admin/csv-tools",
      external_label: "開く",
      status: "todo",
    });
  });
  it("任意項目は null に正規化される", () => {
    const rows = buildRunSteps({ steps });
    expect(rows[1].external_url).toBeNull();
    expect(rows[1].external_label).toBeNull();
  });
  it("元の配列を破壊しない", () => {
    buildRunSteps({ steps });
    expect(steps[0].seq).toBe(2);
  });
});

describe("validateTemplateSteps", () => {
  it("正常なステップはエラーなし", () => {
    expect(
      validateTemplateSteps([
        { seq: 1, title: "A", guide: "a" },
        { seq: 2, title: "B", guide: "b", external_url: "/x", external_label: "X" },
      ])
    ).toEqual([]);
  });
  it("空配列はエラー", () => {
    expect(validateTemplateSteps([])).toContain("steps が空です");
  });
  it("seq の欠番を検出する", () => {
    const errors = validateTemplateSteps([
      { seq: 1, title: "A", guide: "a" },
      { seq: 3, title: "C", guide: "c" },
    ]);
    expect(errors.some((e) => e.includes("連番"))).toBe(true);
  });
  it("title / guide の空を検出する", () => {
    const errors = validateTemplateSteps([{ seq: 1, title: " ", guide: "" }]);
    expect(errors.some((e) => e.includes("title"))).toBe(true);
    expect(errors.some((e) => e.includes("guide"))).toBe(true);
  });
  it("external_url と external_label の片方欠けを検出する", () => {
    const errors = validateTemplateSteps([
      { seq: 1, title: "A", guide: "a", external_url: "/x" },
    ]);
    expect(errors.some((e) => e.includes("対で指定"))).toBe(true);
  });
});
