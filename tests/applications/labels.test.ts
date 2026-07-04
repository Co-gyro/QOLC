import { describe, expect, it } from "vitest";

import {
  ALL_PRIORITIES,
  ALL_SOURCES,
  ALL_STATUSES,
  EVENT_KIND_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  SOURCE_LABELS,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/applications/labels";
import { applicationSourceSchema } from "@/lib/applications/schema";

describe("SOURCE_LABELS（migration 031 拡張分を含む）", () => {
  it("新 source 4種の日本語ラベル", () => {
    expect(SOURCE_LABELS.contact).toBe("お問い合わせ");
    expect(SOURCE_LABELS.support_facility).toBe("施設サポート");
    expect(SOURCE_LABELS.support_family).toBe("ご家族サポート");
    expect(SOURCE_LABELS.support_provider).toBe("提供者サポート");
  });

  it("既存 source のラベルは変更なし", () => {
    expect(SOURCE_LABELS.qolc_merchant).toBe("加盟店申請");
    expect(SOURCE_LABELS.jcb_consult).toBe("住み替え相談");
  });

  it("ALL_SOURCES は6種で、すべてラベルを持つ", () => {
    expect(ALL_SOURCES).toHaveLength(6);
    for (const s of ALL_SOURCES) {
      expect(SOURCE_LABELS[s]).toBeTruthy();
    }
  });
});

describe("EVENT_KIND_LABELS（migration 031 拡張分を含む）", () => {
  it("新イベント3種の日本語ラベル", () => {
    expect(EVENT_KIND_LABELS.comment).toBe("対応メモ");
    expect(EVENT_KIND_LABELS.email_sent).toBe("メール送信");
    expect(EVENT_KIND_LABELS.converted).toBe("加盟店へ変換");
  });

  it("既存イベントのラベルは変更なし", () => {
    expect(EVENT_KIND_LABELS.created).toBe("受付");
    expect(EVENT_KIND_LABELS.commented).toBe("コメント");
  });
});

describe("zod スキーマとラベル定義の同期", () => {
  it("applicationSourceSchema は ALL_SOURCES と同じ値を受け入れる", () => {
    expect([...applicationSourceSchema.options].sort()).toEqual([...ALL_SOURCES].sort());
  });

  it("新 source がバリデーションを通過する", () => {
    for (const s of ["contact", "support_facility", "support_family", "support_provider"]) {
      expect(applicationSourceSchema.safeParse(s).success).toBe(true);
    }
  });

  it("未知の source は拒否する", () => {
    expect(applicationSourceSchema.safeParse("unknown_source").success).toBe(false);
  });
});

describe("既存の網羅性（退行防止）", () => {
  it("全 status / priority がラベルと配色を持つ", () => {
    for (const s of ALL_STATUSES) {
      expect(STATUS_LABELS[s]).toBeTruthy();
      expect(STATUS_COLORS[s]).toBeTruthy();
    }
    for (const p of ALL_PRIORITIES) {
      expect(PRIORITY_LABELS[p]).toBeTruthy();
      expect(PRIORITY_COLORS[p]).toBeTruthy();
    }
  });
});
