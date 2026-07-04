import { describe, expect, it } from "vitest";

import {
  accountInvite,
  applicationReceived,
  reviewApproved,
} from "@/lib/email/templates";
import { ALL_SOURCES } from "@/lib/applications/labels";

describe("applicationReceived", () => {
  it("加盟店申請の受付文面（宛名・受付番号入り）", () => {
    const m = applicationReceived({
      source: "qolc_merchant",
      applicantName: "山田太郎",
      caseNumber: "APP-0001",
    });
    expect(m.subject).toBe("【QOLC】加盟店申請を受け付けました");
    expect(m.text).toContain("山田太郎 様");
    expect(m.text).toContain("受付番号: APP-0001");
    expect(m.text).toContain("2営業日以内");
  });

  it("お問い合わせ（source=contact）はラベルが件名に反映される", () => {
    const m = applicationReceived({ source: "contact" });
    expect(m.subject).toBe("【QOLC】お問い合わせを受け付けました");
  });

  it("名前・受付番号なしでも文面が成立する", () => {
    const m = applicationReceived({ source: "jcb_consult" });
    expect(m.text).toContain("お客様");
    expect(m.text).not.toContain("受付番号");
  });

  it("全 source で生成できる（ラベル欠落なし）", () => {
    for (const source of ALL_SOURCES) {
      const m = applicationReceived({ source });
      expect(m.subject).toMatch(/^【QOLC】.+を受け付けました$/);
      expect(m.text.length).toBeGreaterThan(0);
    }
  });
});

describe("reviewApproved", () => {
  it("加盟店名・受付番号入りの承認案内", () => {
    const m = reviewApproved({
      applicantName: "山田太郎",
      merchantName: "やまだ薬局",
      caseNumber: "APP-0001",
    });
    expect(m.subject).toBe("【QOLC】加盟店審査通過のご案内");
    expect(m.text).toContain("山田太郎 様");
    expect(m.text).toContain("「やまだ薬局」");
    expect(m.text).toContain("受付番号: APP-0001");
  });

  it("加盟店名なしでも文面が成立する", () => {
    const m = reviewApproved({});
    expect(m.text).toContain("加盟店審査が完了し");
    expect(m.text).not.toContain("「");
  });
});

describe("accountInvite", () => {
  it("ポータル名・招待URL・有効期限入りの案内", () => {
    const m = accountInvite({
      recipientName: "佐藤花子",
      portalName: "施設ポータル",
      inviteUrl: "https://app.qolc.jp/invite/abc",
      expiresInDays: 7,
    });
    expect(m.subject).toBe("【QOLC】施設ポータルのアカウントを発行しました");
    expect(m.text).toContain("佐藤花子 様");
    expect(m.text).toContain("https://app.qolc.jp/invite/abc");
    expect(m.text).toContain("有効期限は7日間");
  });

  it("有効期限省略時は期限の記載を省く", () => {
    const m = accountInvite({
      portalName: "提供者ポータル",
      inviteUrl: "https://app.qolc.jp/invite/xyz",
    });
    expect(m.text).not.toContain("有効期限");
    expect(m.text).toContain("お客様");
  });
});
