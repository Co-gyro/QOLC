/**
 * status-flow（申請の対応フローのステッパー組み立て）のテスト
 */
import { describe, it, expect } from "vitest";

import { buildStatusFlow } from "@/lib/applications/status-flow";

describe("buildStatusFlow", () => {
  it("new: 受付は消化済み、対応中が現在地（todo の先頭）", () => {
    const steps = buildStatusFlow("new");
    expect(steps.map((s) => s.status)).toEqual(["done", "todo", "todo"]);
    expect(steps[1].label).toBe("対応中");
  });

  it("waiting: 中間ノードのラベルが「相手待ち」になる", () => {
    expect(buildStatusFlow("waiting")[1].label).toBe("相手待ち");
  });

  it("done: 全ノードが消化済みになる", () => {
    expect(buildStatusFlow("done").every((s) => s.status === "done")).toBe(true);
  });
});
