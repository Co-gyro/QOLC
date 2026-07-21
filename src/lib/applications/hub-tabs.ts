/**
 * 申請ハブの「業務ページ別タブ定義」（業務ファースト構成）
 *
 * applications テーブル（source 6種）を2つの業務ページに振り分ける:
 * - /admin/inquiries    … 相談・問い合わせ（客層でタブ分離: B2C住み替え / B2B事業者 / 既存顧客サポート）
 * - /admin/applications … 加盟店申請・登録（qolc_merchant のみ・ステージ別リスト）
 *
 * 純データ＋純関数のみ（テスト対象）。画面は hub-view.tsx がこの定義を描画する。
 */
import type { ApplicationSource } from "./labels";

/** 業務ページ内の1タブ */
export interface HubTabDef {
  key: string;
  label: string;
  /** このタブに属する申請種別 */
  sources: readonly ApplicationSource[];
  /** 一覧の描画形式（stage=ステージ別リスト / table=汎用テーブル） */
  layout: "stage" | "table";
  /** テーブルに種別列を出すか（複数 source を束ねるタブ用） */
  showSource?: boolean;
  /** タブ直下に出す説明文 */
  hint?: string;
}

/** 加盟店申請・登録（/admin/applications）のタブ */
export const MERCHANT_HUB_TABS: readonly HubTabDef[] = [
  {
    key: "merchant",
    label: "申請案件",
    sources: ["qolc_merchant"],
    layout: "stage",
  },
];

/** 相談・問い合わせ（/admin/inquiries）のタブ */
export const INQUIRY_HUB_TABS: readonly HubTabDef[] = [
  {
    key: "b2c",
    label: "住み替え相談（ご家族）",
    sources: ["jcb_consult"],
    layout: "table",
    hint: "JCB導線などからのご家族・ご本人の住み替え相談。個人向けの丁寧な連絡が前提です。",
  },
  {
    key: "b2b",
    label: "事業者問い合わせ",
    sources: ["contact"],
    layout: "table",
    hint: "施設・提供者など事業者からの導入相談＝営業リード。契約に至ったら加盟店申請へ引き継ぎます。",
  },
  {
    key: "support",
    label: "既存顧客サポート",
    sources: ["support_facility", "support_family", "support_provider"],
    layout: "table",
    showSource: true,
    hint: "稼働中の施設・ご家族・提供者からの問い合わせです。",
  },
];

/** source が属するタブの key を返す（どのタブにも属さなければ null） */
export function tabKeyOfSource(
  tabs: readonly HubTabDef[],
  source: ApplicationSource
): string | null {
  const hit = tabs.find((t) => t.sources.includes(source));
  return hit ? hit.key : null;
}

/**
 * 申請の詳細（作業ページ）へのリンク先（今日のUD などから使用）。
 * 加盟店申請は /admin/applications/[id]、それ以外は /admin/inquiries/[id]。
 */
export function hubHrefOfSource(source: ApplicationSource, id: string): string {
  const base = source === "qolc_merchant" ? "/admin/applications" : "/admin/inquiries";
  return `${base}/${id}`;
}
