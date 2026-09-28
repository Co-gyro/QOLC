import { describe, expect, it } from "vitest";
import {
  addMonthsToDateString,
  isValidDateString,
  jstDateString,
  parseUsenDateTime,
  toJstIso,
  usenDate,
  usenDateTime,
} from "@/lib/merchant-api/time";

describe("JST 変換（実行環境は UTC）", () => {
  // 2026-09-27T15:30:45Z = JST 2026-09-28 00:30:45（日付が変わる境界）
  const d = new Date("2026-09-27T15:30:45Z");

  it("ISO 8601 +09:00", () => {
    expect(toJstIso(d)).toBe("2026-09-28T00:30:45+09:00");
  });

  it("日付・USEN形式", () => {
    expect(jstDateString(d)).toBe("2026-09-28");
    expect(usenDate(d)).toBe("2026/09/28");
    expect(usenDateTime(d)).toBe("2026/09/28 00:30");
  });

  it("USEN の日時文字列（JST）を Date に戻す", () => {
    expect(parseUsenDateTime("2026/09/28 00:30:45")?.toISOString()).toBe("2026-09-27T15:30:45.000Z");
    expect(parseUsenDateTime("bad")).toBeNull();
    expect(parseUsenDateTime(undefined)).toBeNull();
  });
});

describe("addMonthsToDateString", () => {
  it("通常と月末の繰り下げ・年跨ぎ", () => {
    expect(addMonthsToDateString("2026-09-28", 3)).toBe("2026-12-28");
    expect(addMonthsToDateString("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonthsToDateString("2027-11-30", 3)).toBe("2028-02-29");
    expect(addMonthsToDateString("2026-01-31", 1)).toBe("2026-02-28");
  });
});

describe("isValidDateString", () => {
  it("実在日のみ", () => {
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-9-1")).toBe(false);
  });
});
