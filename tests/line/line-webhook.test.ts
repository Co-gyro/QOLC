import { describe, it, expect } from "vitest";

import { extractFollowChanges } from "@/lib/line/webhook";
import { syntheticLineEmail } from "@/lib/line/account";

describe("extractFollowChanges", () => {
  it("follow を followed に変換する", () => {
    const body = { events: [{ type: "follow", source: { userId: "Uabc" } }] };
    expect(extractFollowChanges(body)).toEqual([{ lineUserId: "Uabc", state: "followed" }]);
  });
  it("unfollow を blocked に変換する", () => {
    const body = { events: [{ type: "unfollow", source: { userId: "Uxyz" } }] };
    expect(extractFollowChanges(body)).toEqual([{ lineUserId: "Uxyz", state: "blocked" }]);
  });
  it("message 等の対象外イベントは無視する", () => {
    const body = { events: [{ type: "message", source: { userId: "U1" } }] };
    expect(extractFollowChanges(body)).toEqual([]);
  });
  it("userId のないイベントは無視する", () => {
    const body = { events: [{ type: "follow", source: {} }] };
    expect(extractFollowChanges(body)).toEqual([]);
  });
  it("複数イベントを順に抽出する", () => {
    const body = {
      events: [
        { type: "follow", source: { userId: "U1" } },
        { type: "unfollow", source: { userId: "U2" } },
      ],
    };
    expect(extractFollowChanges(body)).toHaveLength(2);
  });
  it("events なし/不正な入力でも落ちない", () => {
    expect(extractFollowChanges({})).toEqual([]);
    expect(extractFollowChanges(null)).toEqual([]);
    expect(extractFollowChanges("nope")).toEqual([]);
  });
});

describe("syntheticLineEmail", () => {
  it("LINE userId から決定的な内部メールを生成する", () => {
    expect(syntheticLineEmail("U1234ABCD")).toBe("line_u1234abcd@line.qolc.local");
  });
  it("英数字以外を除去する", () => {
    expect(syntheticLineEmail("U-12.34")).toBe("line_u1234@line.qolc.local");
  });
  it("同じ入力には同じ値を返す", () => {
    expect(syntheticLineEmail("Uabc")).toBe(syntheticLineEmail("Uabc"));
  });
});
