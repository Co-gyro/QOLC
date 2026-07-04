/**
 * workflow-client（API 呼び出しラッパー・表示ヘルパー）のテスト
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  fetchWorkflowRuns,
  fetchWorkflowRunDetail,
  fetchWorkflowTemplates,
  createWorkflowRun,
  patchWorkflowRun,
  patchWorkflowStep,
  categoryLabel,
  fmtDate,
  fmtDateTime,
} from "@/lib/portal/workflow-client";

/** fetch モック（呼び出し URL / init を記録して固定レスポンスを返す） */
const calls: Array<{ url: string; init?: RequestInit }> = [];
let nextResponse: unknown = { success: true, data: { items: [] } };

beforeEach(() => {
  calls.length = 0;
  nextResponse = { success: true, data: { items: [] } };
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve({ json: () => Promise.resolve(nextResponse) });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchWorkflowRuns", () => {
  it("フィルタなしはクエリ文字列なしで呼ぶ", async () => {
    await fetchWorkflowRuns();
    expect(calls[0].url).toBe("/api/admin/workflow-runs");
  });
  it("status/assignee/template_code をクエリに載せる", async () => {
    await fetchWorkflowRuns({
      status: "open",
      assignee: "u-1",
      template_code: "daily_ops_check",
    });
    expect(calls[0].url).toBe(
      "/api/admin/workflow-runs?status=open&assignee=u-1&template_code=daily_ops_check"
    );
  });
  it("失敗レスポンスは throw する", async () => {
    nextResponse = { success: false, error: "取得に失敗しました" };
    await expect(fetchWorkflowRuns()).rejects.toThrow("取得に失敗しました");
  });
});

describe("fetchWorkflowRunDetail / fetchWorkflowTemplates", () => {
  it("詳細は /api/admin/workflow-runs/[id] を GET する", async () => {
    nextResponse = { success: true, data: { id: "r-1" } };
    const d = await fetchWorkflowRunDetail("r-1");
    expect(calls[0].url).toBe("/api/admin/workflow-runs/r-1");
    expect(d).toEqual({ id: "r-1" });
  });
  it("テンプレ一覧は /templates を GET する", async () => {
    await fetchWorkflowTemplates();
    expect(calls[0].url).toBe("/api/admin/workflow-runs/templates");
  });
});

describe("createWorkflowRun / patchWorkflowRun / patchWorkflowStep", () => {
  it("起票は POST + JSON ボディ", async () => {
    nextResponse = { success: true, data: { id: "r-1", title: "t" } };
    await createWorkflowRun({ template_code: "daily_ops_check" });
    expect(calls[0].url).toBe("/api/admin/workflow-runs");
    expect(calls[0].init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      template_code: "daily_ops_check",
    });
  });
  it("run 更新は PATCH /[id]", async () => {
    nextResponse = { success: true, data: { id: "r-1", updated: ["status"] } };
    await patchWorkflowRun("r-1", { status: "canceled" });
    expect(calls[0].url).toBe("/api/admin/workflow-runs/r-1");
    expect(calls[0].init?.method).toBe("PATCH");
  });
  it("ステップ更新は PATCH /[id]/steps/[stepId]", async () => {
    nextResponse = { success: true, data: { stepId: "s-1", runStatus: "open", autoCompleted: false } };
    const res = await patchWorkflowStep("r-1", "s-1", { status: "done" });
    expect(calls[0].url).toBe("/api/admin/workflow-runs/r-1/steps/s-1");
    expect(calls[0].init?.method).toBe("PATCH");
    expect(res.autoCompleted).toBe(false);
  });
});

describe("categoryLabel", () => {
  it("既知カテゴリは日本語ラベル", () => {
    expect(categoryLabel("settlement")).toBe("精算");
    expect(categoryLabel("merchant")).toBe("加盟店");
    expect(categoryLabel("daily")).toBe("日次運用");
  });
  it("未知カテゴリはそのまま / null は「—」", () => {
    expect(categoryLabel("other")).toBe("other");
    expect(categoryLabel(null)).toBe("—");
  });
});

describe("fmtDate / fmtDateTime", () => {
  it("null は「—」", () => {
    expect(fmtDate(null)).toBe("—");
    expect(fmtDateTime(null)).toBe("—");
  });
  it("YYYY/MM/DD 形式で整形する", () => {
    expect(fmtDate("2026-07-04T00:00:00")).toBe("2026/07/04");
  });
  it("YYYY/MM/DD HH:mm 形式で整形する", () => {
    expect(fmtDateTime("2026-07-04T09:05:00")).toBe("2026/07/04 09:05");
  });
});
