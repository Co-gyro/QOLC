/**
 * hub-tabs（業務ページ別タブ定義）のテスト
 * 全 source が2つの業務ページのどちらか一方・ちょうど1タブに属することを保証する。
 */
import { describe, it, expect } from "vitest";

import {
  INQUIRY_HUB_TABS,
  MERCHANT_HUB_TABS,
  tabKeyOfSource,
  hubHrefOfSource,
} from "@/lib/applications/hub-tabs";
import { ALL_SOURCES } from "@/lib/applications/labels";

describe("tabKeyOfSource", () => {
  it("全 source がどちらか一方のページのちょうど1タブに属する", () => {
    for (const source of ALL_SOURCES) {
      const inMerchant = tabKeyOfSource(MERCHANT_HUB_TABS, source);
      const inInquiry = tabKeyOfSource(INQUIRY_HUB_TABS, source);
      // 両方に属することはない
      expect(inMerchant && inInquiry).toBeFalsy();
      // どちらにも属さないことはない（こぼれる source を作らない）
      expect(inMerchant ?? inInquiry).toBeTruthy();
    }
  });

  it("客層でタブが分かれる（B2C=住み替え / B2B=事業者 / サポート3種=support）", () => {
    expect(tabKeyOfSource(INQUIRY_HUB_TABS, "jcb_consult")).toBe("b2c");
    expect(tabKeyOfSource(INQUIRY_HUB_TABS, "contact")).toBe("b2b");
    expect(tabKeyOfSource(INQUIRY_HUB_TABS, "support_facility")).toBe("support");
    expect(tabKeyOfSource(INQUIRY_HUB_TABS, "support_family")).toBe("support");
    expect(tabKeyOfSource(INQUIRY_HUB_TABS, "support_provider")).toBe("support");
  });

  it("加盟店申請はステージ別リスト、相談・問い合わせはテーブル", () => {
    expect(tabKeyOfSource(MERCHANT_HUB_TABS, "qolc_merchant")).toBe("merchant");
    expect(MERCHANT_HUB_TABS[0].layout).toBe("stage");
    for (const t of INQUIRY_HUB_TABS) expect(t.layout).toBe("table");
  });
});

describe("hubHrefOfSource", () => {
  it("加盟店申請は /admin/applications/[id]、それ以外は /admin/inquiries/[id] の作業ページへ", () => {
    expect(hubHrefOfSource("qolc_merchant", "abc")).toBe("/admin/applications/abc");
    expect(hubHrefOfSource("jcb_consult", "abc")).toBe("/admin/inquiries/abc");
    expect(hubHrefOfSource("contact", "xyz")).toBe("/admin/inquiries/xyz");
    expect(hubHrefOfSource("support_family", "xyz")).toBe("/admin/inquiries/xyz");
  });
});
