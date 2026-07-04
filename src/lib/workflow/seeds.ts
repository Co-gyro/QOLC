/**
 * ワークフローテンプレート／定期起票ルールのシード定義
 *
 * migration 030_create_workflow_engine.sql のシードデータと完全一致させること
 * （tests/workflow/seeds.test.ts が SQL と本ファイルの一致を検証する）。
 * ガイド文は「初めての担当者がマニュアルなしで作業できる具体性」で書く。
 *
 * 精算サイクル（src/lib/csv/selfish-common.ts の締日算出と整合）:
 *   15日締め … 当月1日〜15日利用分。毎月20日に起票し、翌月15日に支払先へ振込
 *   末日締め … 前月16日〜前月末日利用分。毎月5日に起票し、当月末日に支払先へ振込
 */
import type { RecurringCadence, WorkflowTemplateStep } from "./types";

/** テンプレートのシード1件 */
export interface WorkflowTemplateSeed {
  code: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowTemplateStep[];
}

/** 定期起票ルールのシード1件 */
export interface RecurringRuleSeed {
  code: string;
  name: string;
  template_code: string;
  cadence: RecurringCadence;
  day_of_month: number | null;
  title_pattern: string;
  enabled: boolean;
}

/** 月次精算8工程を締めサイクル別の文言で生成する共通定義 */
function settlementSteps(opts: {
  /** 対象期間の説明（例: 当月1日〜15日利用分） */
  period: string;
  /** JCB/セゾンからUDへの入金時期の目安 */
  inbound: string;
  /** UD→支払先の振込日 */
  payoutDate: string;
}): WorkflowTemplateStep[] {
  return [
    {
      seq: 1,
      title: "JCB Linkから3種CSVをダウンロード",
      guide:
        `JCB Link（加盟店向けWeb明細サービス）にログインし、売上明細（UR）・振込情報（FI）・振込明細（FM）の3種のCSVをダウンロードする。対象は${opts.period}（JCBからUDへの入金は${opts.inbound}）。ダウンロードしたファイルは名前を変えずに作業用フォルダへ保存する。完了条件: 3ファイルが揃っていること。`,
      external_url: "https://www.jcb-link.jp/",
      external_label: "JCB Linkを開く",
    },
    {
      seq: 2,
      title: "NetアンサーforBizからセゾンのCSVと支払計算書PDFをダウンロード",
      guide:
        `セゾンの法人向けWeb明細「NetアンサーforBiz」（ブックマークのURLからログイン）で、対象期間（${opts.period}）の売上明細CSVと支払計算書PDFをダウンロードする。セゾンの振込情報（FI）・振込明細（FM）は支払計算書PDFと売上CSVから生成するため、両方が必要。完了条件: 売上明細CSVと支払計算書PDFが揃っていること。`,
    },
    {
      seq: 3,
      title: "CSV変換ツールでJCBの3ファイルをリネーム",
      guide:
        "QOLC管理画面のCSV変換ツールを開き、JCBタブでダウンロードした3ファイルを読み込む。JCBのCSVは内容を加工せず、セルフィッシュの命名規則「{カード会社}_{データ種別}_{締日}_{支払先番号}.csv」（例: JCB_UR_20260715_123456789.csv）へのリネームのみ行う。支払先番号はJCBは9桁の数字。出力はShift-JIS（CP932）・改行CRLF。完了条件: JCB_UR / JCB_FI / JCB_FM の3ファイルが正しい名前で出力されていること。",
      external_url: "/admin/csv-tools",
      external_label: "CSV変換ツールを開く",
    },
    {
      seq: 4,
      title: "CSV変換ツールでセゾンのUR/FI/FMを生成",
      guide:
        "CSV変換ツールのセゾンタブで売上明細CSVと支払計算書PDFを読み込む。UR（売上明細）はリネームのみ、FI（振込情報）とFM（振込明細）は集計処理でセルフィッシュ共通フォーマット（Shift-JIS・CRLF）として生成される。セゾンの支払先番号は加盟店No.（通常7桁）。完了条件: SAISON_UR / SAISON_FI / SAISON_FM の3ファイルが出力されていること。",
      external_url: "/admin/csv-tools",
      external_label: "CSV変換ツールを開く",
    },
    {
      seq: 5,
      title: "セルフィッシュへ6ファイルをアップロード",
      guide:
        "セルフィッシュ（精算代行システム）にログインし、JCBの3ファイルとセゾンの3ファイル、計6ファイルをアップロードする。ファイル名は変更しないこと（命名規則からカード会社・データ種別・締日・支払先を判定するため）。完了条件: 6ファイルすべてがエラーなく取り込まれていること。",
    },
    {
      seq: 6,
      title: "セルフィッシュの処理結果を確認",
      guide:
        "セルフィッシュで手数料計算の結果と支払通知書の内容を確認する。支払通知書の金額がJCBの振込明細・セゾンの支払計算書PDFと一致しているか、対象支払先に抜け漏れがないかを照合する。差異がある場合はアップロードしたファイルを見直し、修正のうえ再取込する。完了条件: 支払通知書の金額が元データと一致していること。",
    },
    {
      seq: 7,
      title: "銀行振込用CSVを生成",
      guide:
        `セルフィッシュで銀行振込用CSV（総合振込データ）を生成してダウンロードする。振込日には${opts.payoutDate}を指定する。完了条件: 振込用CSVがダウンロードできていること。`,
    },
    {
      seq: 8,
      title: "銀行サイトで振込予約",
      guide:
        `法人インターネットバンキングにログインし、振込用CSVをアップロードして総合振込を予約する（振込日: ${opts.payoutDate}）。予約後、件数・合計金額がセルフィッシュの支払通知書と一致していることを確認し、承認者へ承認を依頼する。完了条件: 振込予約が承認済みになっていること。`,
    },
  ];
}

/** テンプレートシード（migration 030 と一致必須） */
export const WORKFLOW_TEMPLATE_SEEDS: WorkflowTemplateSeed[] = [
  {
    code: "monthly_settlement_15",
    name: "15日締め精算（月次）",
    description:
      "当月1日〜15日利用分の精算。カード会社の明細取得からセルフィッシュ処理・銀行振込予約（翌月15日振込）までの8工程。",
    category: "settlement",
    steps: settlementSteps({
      period: "当月1日〜15日利用分（15日締め）",
      inbound: "当月末日",
      payoutDate: "翌月15日（15日締め分の支払日）",
    }),
  },
  {
    code: "monthly_settlement_eom",
    name: "末日締め精算（月次）",
    description:
      "前月16日〜前月末日利用分の精算。カード会社の明細取得からセルフィッシュ処理・銀行振込予約（当月末日振込）までの8工程。",
    category: "settlement",
    steps: settlementSteps({
      period: "前月16日〜前月末日利用分（末日締め）",
      inbound: "当月15日ごろ",
      payoutDate: "当月末日（末日締め分の支払日）",
    }),
  },
  {
    code: "merchant_application",
    name: "加盟店申請（都度）",
    description:
      "加盟店申請の受付から審査・各社登録・アカウント発行・初期設定サポートまでの13工程。",
    category: "merchant",
    steps: [
      {
        seq: 1,
        title: "受付内容の確認",
        guide:
          "申請/タスク一覧で該当案件を開き、法人情報（法人名・法人番号・所在地）、施設情報、ご担当者の連絡先に不備がないか確認する。不明点があれば申請者へメールまたは電話で確認し、対応内容を案件のタイムラインに記録する。完了条件: 申請書生成に必要な情報が揃っていること。",
        external_url: "/admin/applications",
        external_label: "申請/タスク一覧を開く",
      },
      {
        seq: 2,
        title: "モールコード・端末識別番号の採番",
        guide:
          "加盟店管理で新規加盟店を作成する。作成時にUSENのモールコード（A300〜A3ZZ。USEN決済上で加盟店を識別するコード）と端末識別番号（3124620001000〜）がプールから自動で採番される。手入力での採番は行わないこと（重複防止）。完了条件: 加盟店レコードが作成され、モールコードと端末識別番号が付与されていること。",
        external_url: "/admin/merchants",
        external_label: "加盟店管理を開く",
      },
      {
        seq: 3,
        title: "UD補足情報の入力",
        guide:
          "案件詳細の「UD追記情報」に、顧客の入力にはない申請書用の項目（業態コード、POS支店コード、取扱開始希望日など）を追記する。顧客入力（payload）とUD追記（ud_input）は分けて保存されるため、顧客の入力値は書き換えないこと。完了条件: 申請書生成に必要なUD側項目がすべて入力されていること。",
        external_url: "/admin/applications",
        external_label: "申請/タスク一覧を開く",
      },
      {
        seq: 4,
        title: "申請書の生成",
        guide:
          "加盟店申請フォームで対象加盟店を選び、JCB EC用・JCB店頭用・セゾン用の申請書を生成する。生成前に法人名・所在地・口座情報・業態コードが受付内容とUD追記情報のとおりか確認する。完了条件: 提出用の申請書一式が生成・保存されていること。",
        external_url: "/admin/merchant-application",
        external_label: "加盟店申請フォームを開く",
      },
      {
        seq: 5,
        title: "JCBへ申請書を提出",
        guide:
          "JCBの加盟店受付サイト（accel.jcb.jp）にログインし、生成した申請書を提出する。提出したら審査記録に提出日を登録する。完了条件: 提出完了画面まで確認し、提出日が記録されていること。",
        external_url: "https://accel.jcb.jp/",
        external_label: "JCB受付サイトを開く",
      },
      {
        seq: 6,
        title: "セゾンへ申請書を提出",
        guide:
          "セゾンの加盟店担当窓口へ、生成したセゾン用申請書をメールで送付する。送付後、審査記録に提出日を登録する。完了条件: 送付メールの控えが残り、提出日が記録されていること。",
      },
      {
        seq: 7,
        title: "USEN FinTechへ加盟店情報を共有",
        guide:
          "指定のGoogleドライブ共有フォルダに加盟店情報一式（申請書・モールコード・端末識別番号）を格納し、USEN FinTechの担当者へ格納した旨を連絡する。完了条件: フォルダ格納と連絡の両方が済んでいること。",
        external_url: "https://drive.google.com/",
        external_label: "Googleドライブを開く",
      },
      {
        seq: 8,
        title: "審査結果の登録",
        guide:
          "JCB・セゾンから届いた審査結果を審査記録に登録する。JCBの加盟店番号は登録型（会員ID決済・継続課金用）と都度型EC（カード登録時のトークン決済用）の2種が発番されるため、必ず両方を控える。NGの場合は理由を記録し、申請者へ結果と今後の対応を連絡する。完了条件: 結果・結果受領日・（NG時は理由）が登録されていること。",
        external_url: "/admin/merchants",
        external_label: "加盟店管理を開く",
      },
      {
        seq: 9,
        title: "QOLCへ加盟店番号を登録",
        guide:
          "加盟店管理で該当加盟店を開き、JCB加盟店番号2種（登録型・都度型EC）とセゾン加盟店番号を登録する。番号の桁数（JCBは最大17桁、セゾンは7桁）と入力誤りがないか登録後に見直す。完了条件: 3つの加盟店番号が登録されていること。",
        external_url: "/admin/merchants",
        external_label: "加盟店管理を開く",
      },
      {
        seq: 10,
        title: "セルフィッシュへ支払先を登録",
        guide:
          "セルフィッシュに新しい支払先を登録する。支払先番号はJCBが9桁、セゾンは加盟店No.（通常7桁）。振込先口座情報は申請書の記載と一致させること。完了条件: セルフィッシュ上で支払先として検索できること。",
      },
      {
        seq: 11,
        title: "USEN側の登録確認（テスト決済）",
        guide:
          "USEN FinTech側で端末識別番号・モールコードの登録が完了しているかを確認する。確認はテストカードによるカード登録（1円与信。自動失効するため取消不要）で行う。エラーになる場合はUSEN FinTech担当へ登録状況を確認する。完了条件: テスト決済が正常応答を返すこと。",
      },
      {
        seq: 12,
        title: "アカウント発行",
        guide:
          "施設管理から対象施設・提供者のアカウントを発行し、招待メールを送付する。送付後、案件のタイムラインに発行した旨を記録する。完了条件: 招待メールが送信され、記録が残っていること。",
        external_url: "/admin/facilities",
        external_label: "施設管理を開く",
      },
      {
        seq: 13,
        title: "初期設定サポート",
        guide:
          "先方の初回ログインに合わせて、パスワード設定・カード登録・明細アップロードの手順を電話またはオンラインで案内する。案内後、つまずいた点があれば案件のタイムラインに記録し、案件を完了にする。完了条件: 先方が一連の初期設定を完了していること。",
      },
    ],
  },
  {
    code: "daily_ops_check",
    name: "日次運用確認",
    description: "レセプトアップロード・決済結果・保留決済を毎日確認する3工程。",
    category: "daily",
    steps: [
      {
        seq: 1,
        title: "レセプトアップロード状況の確認",
        guide:
          "管理ダッシュボードで本日時点のレセプト（明細）アップロード状況を確認する。締切が近いのに未着の提供者があれば、電話またはメールでアップロードを依頼する。完了条件: 未着の提供者への連絡が済んでいること（未着なしの場合は確認のみで完了）。",
        external_url: "/admin/dashboard",
        external_label: "ダッシュボードを開く",
      },
      {
        seq: 2,
        title: "決済結果の確認・エラー対応",
        guide:
          "決済管理で失敗ステータスの決済を確認する。カード有効期限切れ・限度額超過などの理由別に、ご家族への連絡やカード再登録の案内を行う。対応した内容は決済のメモに記録する。完了条件: 本日分の失敗決済すべてに対応方針が付いていること。",
        external_url: "/admin/payments?status=failed",
        external_label: "失敗決済一覧を開く",
      },
      {
        seq: 3,
        title: "保留決済の確認",
        guide:
          "保留中の決済を確認し、保留理由（金額確認待ち・カード登録待ちなど）が解消されたものは再実行し、対象外と判明したものは理由を記録して取消する。完了条件: 保留一覧に判断待ちのまま放置されている決済がないこと。",
        external_url: "/admin/payments",
        external_label: "決済管理を開く",
      },
    ],
  },
];

/** 定期起票ルールのシード（migration 030 と一致必須） */
export const RECURRING_RULE_SEEDS: RecurringRuleSeed[] = [
  {
    code: "settlement_15_monthly",
    name: "15日締め精算の起票",
    template_code: "monthly_settlement_15",
    cadence: "monthly",
    day_of_month: 20,
    title_pattern: "{year}年{month}月 15日締め精算",
    enabled: true,
  },
  {
    code: "settlement_eom_monthly",
    name: "末日締め精算の起票",
    template_code: "monthly_settlement_eom",
    cadence: "monthly",
    day_of_month: 5,
    title_pattern: "{prev_year}年{prev_month}月 末日締め精算",
    enabled: true,
  },
  {
    code: "daily_ops_daily",
    name: "日次運用確認の起票",
    template_code: "daily_ops_check",
    cadence: "daily",
    day_of_month: null,
    title_pattern: "{year}年{month}月{day}日 日次運用確認",
    enabled: true,
  },
];
